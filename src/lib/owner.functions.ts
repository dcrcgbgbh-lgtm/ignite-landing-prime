import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import { mergeSettings, type ChatMessage, type SiteSettings } from "./site-config";

const BUCKET = "chat-prints";

type AdminClient = Awaited<
  typeof import("@/integrations/supabase/client.server")
>["supabaseAdmin"];

async function adminClient(): Promise<AdminClient> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

type Ctx = { supabase: { rpc: (n: string, a: unknown) => Promise<{ data: unknown }> }; userId: string };

async function requireOwner(context: unknown): Promise<{ db: AdminClient; userId: string }> {
  const ctx = context as Ctx;
  const { data } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "owner",
  });
  if (data !== true) throw new Error("Acesso restrito ao proprietário.");
  return { db: await adminClient(), userId: ctx.userId };
}

async function audit(
  db: AdminClient,
  userId: string,
  action: string,
  entity: string,
  details: Record<string, unknown>,
) {
  await db.from("audit_log").insert({ actor_id: userId, action, entity, details });
}

async function signMessages(db: AdminClient, rows: Record<string, unknown>[]) {
  const out: (ChatMessage & { read_by_owner?: boolean })[] = [];
  for (const row of rows) {
    let url = (row['image_url'] as string | null) ?? null;
    if (url && !url.startsWith("http")) {
      const { data } = await db.storage.from(BUCKET).createSignedUrl(url, 60 * 60);
      url = data?.signedUrl ?? null;
    }
    out.push({
      id: row['id'] as string,
      sender: row['sender'] as ChatMessage["sender"],
      content: (row['content'] as string) ?? "",
      image_url: url,
      created_at: row['created_at'] as string,
    });
  }
  return out;
}

// ------------------------------------------------------------------ bootstrap

/** Concede o papel OWNER ao usuário autenticado — apenas se ainda não existir nenhum owner. */
export const claimOwnership = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as unknown as Ctx;
    const db = await adminClient();
    const { count } = await db
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "owner");
    if ((count ?? 0) > 0) throw new Error("Já existe um proprietário definido para este site.");
    const { error } = await db
      .from("user_roles")
      .insert({ user_id: ctx.userId, role: "owner" });
    if (error) throw new Error(error.message);
    await audit(db, ctx.userId, "bootstrap_owner", "user_roles", {});
    return { ok: true };
  });

export const getOwnerStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as unknown as Ctx;
    const db = await adminClient();
    const { data } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "owner" });
    const { count } = await db
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "owner");
    return { isOwner: data === true, ownerExists: (count ?? 0) > 0 };
  });

// ------------------------------------------------------------------ dashboard

export const getDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { db } = await requireOwner(context);

    const countEvent = async (t: string) =>
      (
        await db
          .from("visitor_events")
          .select("id", { count: "exact", head: true })
          .eq("event_type", t)
      ).count ?? 0;

    const [
      site_visit,
      access_flow,
      free_access,
      paid_access,
      chat_started,
      checkout_started,
      screenshot_uploaded,
    ] = await Promise.all([
      countEvent("site_visit"),
      countEvent("access_flow"),
      countEvent("free_access"),
      countEvent("paid_access"),
      countEvent("chat_started"),
      countEvent("checkout_started"),
      countEvent("screenshot_uploaded"),
    ]);

    const [totalEvents, conversations, messages, prints, confirmed, clicks] = await Promise.all([
      db.from("visitor_events").select("id", { count: "exact", head: true }),
      db.from("conversations").select("id, unread_count", { count: "exact" }),
      db.from("messages").select("id", { count: "exact", head: true }).eq("sender", "user"),
      db.from("messages").select("id", { count: "exact", head: true }).not("image_url", "is", null),
      db
        .from("purchase_events")
        .select("id", { count: "exact", head: true })
        .eq("status", "confirmed"),
      db
        .from("purchase_events")
        .select("id", { count: "exact", head: true })
        .eq("status", "checkout_started"),
    ]);

    const unread = (conversations.data ?? []).reduce((a, c) => a + (c.unread_count ?? 0), 0);

    const { data: recent } = await db
      .from("visitor_events")
      .select("event_type, session_id, created_at")
      .order("created_at", { ascending: false })
      .limit(15);

    const { data: plans } = await db
      .from("plans")
      .select("id, name, price, pix_payload, active")
      .order("sort_order");

    return {
      metrics: {
        site_visit,
        access_flow,
        free_access,
        paid_access,
        chat_started,
        checkout_clicks: clicks.count ?? 0,
        checkout_started,
        screenshot_uploaded,
        conversations: conversations.count ?? 0,
        messages: messages.count ?? 0,
        prints: prints.count ?? 0,
        confirmed: confirmed.count ?? 0,
        unread,
        events_total: totalEvents.count ?? 0,
      },
      recent: recent ?? [],
      pix: (plans ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        price: p.price,
        payload: p.pix_payload ?? "",
        active: p.active,
      })),
    };
  });

// ------------------------------------------------------------------- mensagens

export const listConversations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { filter?: string; search?: string }) => input ?? {})
  .handler(async ({ context, data }) => {
    const { db } = await requireOwner(context);
    let q = db.from("conversations").select("*").order("last_message_at", { ascending: false, nullsFirst: false });

    switch (data.filter) {
      case "unread":
        q = q.gt("unread_count", 0);
        break;
      case "aguardando_print":
      case "print_recebido":
      case "erro_relatado":
      case "foi_para_pago":
        q = q.eq("stage", data.filter);
        break;
      case "archived":
        q = q.eq("archived", true);
        break;
      case "finalizadas":
        q = q.eq("status", "closed");
        break;
      default:
        q = q.eq("archived", false);
    }
    if (data.search) q = q.ilike("session_id", `%${data.search}%`);

    const { data: rows } = await q.limit(200);
    const list = rows ?? [];
    const withCounts = await Promise.all(
      list.map(async (c) => {
        const [{ count: msgs }, { count: prints }] = await Promise.all([
          db.from("messages").select("id", { count: "exact", head: true }).eq("conversation_id", c.id),
          db
            .from("messages")
            .select("id", { count: "exact", head: true })
            .eq("conversation_id", c.id)
            .not("image_url", "is", null),
        ]);
        return { ...c, message_count: msgs ?? 0, print_count: prints ?? 0 };
      }),
    );
    const totalUnread = (
      await db.from("conversations").select("unread_count")
    ).data?.reduce((a, c) => a + (c.unread_count ?? 0), 0) ?? 0;
    return { conversations: withCounts, totalUnread };
  });

export const getConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => {
    if (!input?.id) throw new Error("Conversa inválida");
    return input;
  })
  .handler(async ({ context, data }) => {
    const { db } = await requireOwner(context);
    const { data: conversation } = await db
      .from("conversations")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (!conversation) throw new Error("Conversa não encontrada.");
    const { data: rows } = await db
      .from("messages")
      .select("id, sender, content, image_url, created_at")
      .eq("conversation_id", data.id)
      .order("created_at", { ascending: true });
    return {
      conversation,
      messages: await signMessages(db, (rows ?? []) as unknown as Record<string, unknown>[]),
    };
  });

export const ownerReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; content: string }) => {
    const content = (input?.content ?? "").trim();
    if (!input?.id || !content) throw new Error("Escreva uma mensagem.");
    return { id: input.id, content: content.slice(0, 2000) };
  })
  .handler(async ({ context, data }) => {
    const { db } = await requireOwner(context);
    const { error } = await db
      .from("messages")
      .insert({ conversation_id: data.id, sender: "owner", content: data.content, read_by_owner: true });
    if (error) throw new Error(error.message);
    await db
      .from("conversations")
      .update({
        last_message: data.content.slice(0, 200),
        last_message_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    return { ok: true };
  });

export const updateConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { id: string; action: "read" | "close" | "reopen" | "archive" | "unarchive" | "delete" }) => {
      if (!input?.id) throw new Error("Conversa inválida");
      return input;
    },
  )
  .handler(async ({ context, data }) => {
    const { db, userId } = await requireOwner(context);
    if (data.action === "delete") {
      await db.from("messages").delete().eq("conversation_id", data.id);
      await db.from("conversations").delete().eq("id", data.id);
      await audit(db, userId, "delete", "conversation", { id: data.id });
      return { ok: true, deleted: true };
    }
    const patch: Record<string, unknown> = {};
    if (data.action === "read") {
      patch['unread_count'] = 0;
      await db.from("messages").update({ read_by_owner: true }).eq("conversation_id", data.id);
    }
    if (data.action === "close") patch['status'] = "closed";
    if (data.action === "reopen") patch['status'] = "open";
    if (data.action === "archive") patch['archived'] = true;
    if (data.action === "unarchive") patch['archived'] = false;
    await db.from("conversations").update(patch).eq("id", data.id);
    return { ok: true, deleted: false };
  });

export const deleteMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { messageId: string }) => {
    if (!input?.messageId) throw new Error("Mensagem inválida");
    return input;
  })
  .handler(async ({ context, data }) => {
    const { db, userId } = await requireOwner(context);
    await db.from("messages").delete().eq("id", data.messageId);
    await audit(db, userId, "delete", "message", { id: data.messageId });
    return { ok: true };
  });

// ---------------------------------------------------------------------- painel

export const getAdminConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { db } = await requireOwner(context);
    const [settingsRes, plansRes, rulesRes, auditRes] = await Promise.all([
      db.from("site_settings").select("key, value"),
      db.from("plans").select("*").order("sort_order"),
      db.from("bot_rules").select("*").order("priority"),
      db.from("audit_log").select("*").order("created_at", { ascending: false }).limit(20),
    ]);
    const raw: Record<string, unknown> = {};
    for (const row of settingsRes.data ?? []) raw[row.key] = row.value;
    return {
      settings: mergeSettings(raw) as SiteSettings,
      plans: plansRes.data ?? [],
      rules: rulesRes.data ?? [],
      audit: auditRes.data ?? [],
    };
  });

export const saveSetting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { key: string; value: Record<string, unknown> }) => {
    if (!input?.key || typeof input.value !== "object") throw new Error("Configuração inválida");
    return input;
  })
  .handler(async ({ context, data }) => {
    const { db, userId } = await requireOwner(context);
    const { error } = await db
      .from("site_settings")
      .upsert({ key: data.key, value: data.value as never, is_public: true }, { onConflict: "key" });
    if (error) throw new Error(error.message);
    await audit(db, userId, "update", `site_settings:${data.key}`, {});
    return { ok: true };
  });

export const savePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Record<string, unknown>) => {
    if (!input?.['id']) throw new Error("Plano inválido");
    return input;
  })
  .handler(async ({ context, data }) => {
    const { db, userId } = await requireOwner(context);
    const { data: before } = await db
      .from("plans")
      .select("pix_payload")
      .eq("id", data['id'] as string)
      .maybeSingle();
    const { error } = await db.from("plans").upsert(data as never, { onConflict: "id" });
    if (error) throw new Error(error.message);
    if (before?.pix_payload !== data['pix_payload']) {
      await audit(db, userId, "update_pix", `plan:${data['id']}`, {
        changed: true,
      });
    }
    await audit(db, userId, "update", `plan:${data['id']}`, {});
    return { ok: true };
  });

export const saveBotRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Record<string, unknown>) => input)
  .handler(async ({ context, data }) => {
    const { db, userId } = await requireOwner(context);
    const { error } = await db.from("bot_rules").upsert(data as never);
    if (error) throw new Error(error.message);
    await audit(db, userId, "update", "bot_rule", { id: data['id'] ?? null });
    return { ok: true };
  });

export const deleteBotRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => {
    if (!input?.id) throw new Error("Regra inválida");
    return input;
  })
  .handler(async ({ context, data }) => {
    const { db, userId } = await requireOwner(context);
    await db.from("bot_rules").delete().eq("id", data.id);
    await audit(db, userId, "delete", "bot_rule", { id: data.id });
    return { ok: true };
  });

export const confirmPurchase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; note?: string }) => {
    if (!input?.id) throw new Error("Compra inválida");
    return input;
  })
  .handler(async ({ context, data }) => {
    const { db, userId } = await requireOwner(context);
    await db
      .from("purchase_events")
      .update({
        status: "confirmed",
        confirmed_at: new Date().toISOString(),
        confirmed_by: userId,
        note: data.note ?? null,
      })
      .eq("id", data.id);
    await audit(db, userId, "confirm_purchase", `purchase:${data.id}`, {});
    return { ok: true };
  });

export const listPurchases = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { db } = await requireOwner(context);
    const { data } = await db
      .from("purchase_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    return { purchases: data ?? [] };
  });
