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
  await db
    .from("audit_log")
    .insert({ actor_id: userId, action, entity, details: details as never });
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
  .inputValidator((input: { period?: "today" | "month" | "all" } = {}) => input)
  .handler(async ({ context, data }) => {
    const { db } = await requireOwner(context);

    const period = data.period ?? "all";
    const now = new Date();
    const start = period === "today"
      ? new Date(now.getFullYear(), now.getMonth(), now.getDate())
      : period === "month"
        ? new Date(now.getFullYear(), now.getMonth(), 1)
        : null;
    const since = start?.toISOString();

    const countEvent = async (t: string) => {
      let q = db.from("visitor_events").select("id", { count: "exact", head: true }).eq("event_type", t);
      if (since) q = q.gte("created_at", since);
      return (await q).count ?? 0;
    };

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
      (() => {
        let q = db.from("visitor_events").select("id", { count: "exact", head: true });
        return since ? q.gte("created_at", since) : q;
      })(),
      db.from("conversations").select("id, unread_count", { count: "exact" }),
      (() => {
        let q = db.from("messages").select("id", { count: "exact", head: true }).eq("sender", "user");
        return since ? q.gte("created_at", since) : q;
      })(),
      (() => {
        let q = db.from("messages").select("id", { count: "exact", head: true }).not("image_url", "is", null);
        return since ? q.gte("created_at", since) : q;
      })(),
      (() => {
        let q = db.from("purchase_events").select("id", { count: "exact", head: true }).eq("status", "confirmed");
        return since ? q.gte("created_at", since) : q;
      })(),
      (() => {
        let q = db.from("purchase_events").select("id", { count: "exact", head: true }).eq("status", "checkout_started");
        return since ? q.gte("created_at", since) : q;
      })(),
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
    const patch: {
      unread_count?: number;
      status?: string;
      archived?: boolean;
    } = {};
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

export const getCouponUsage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { db } = await requireOwner(context);
    const { data: settingRow } = await db
      .from("site_settings")
      .select("value")
      .eq("key", "coupons")
      .maybeSingle();
    const coupons = Array.isArray(settingRow?.value) ? settingRow.value as Record<string, unknown>[] : [];
    const usage: Record<string, number> = {};
    for (const coupon of coupons) {
      const couponId = String(coupon.id ?? "");
      if (!couponId) continue;
      let query = db
        .from("visitor_events")
        .select("id", { count: "exact", head: true })
        .eq("event_type", "coupon_redeemed")
        .contains("metadata", { coupon_id: couponId });
      const resetAt = typeof coupon.usage_reset_at === "string" && coupon.usage_reset_at
        ? coupon.usage_reset_at
        : "1970-01-01T00:00:00.000Z";
      query = query.gte("created_at", resetAt);
      const { count } = await query;
      usage[couponId] = count ?? 0;
    }
    return { usage };
  });

export const saveSetting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { key: string; value: Record<string, unknown> }) => {
    if (!input?.key || typeof input.value !== "object") throw new Error("Configuração inválida");
    return input;
  })
  .handler(async ({ context, data }) => {
    const { db, userId } = await requireOwner(context);
    const value =
      data.key === "coupons"
        ? (Array.isArray(data.value)
            ? data.value.map((coupon) => {
                const row = { ...(coupon as Record<string, unknown>) };
                delete row["used_count"];
                return row;
              })
            : data.value)
        : data.value;
    const { error } = await db
      .from("site_settings")
      .upsert({ key: data.key, value: value as never, is_public: true }, { onConflict: "key" });
    if (error) throw new Error(error.message);

    if (data.key === "bot_messages") {
      const bot = data.value as Record<string, unknown>;
      if (bot["steps_enabled"] === false) {
        await db
          .from("messages")
          .delete()
          .eq("sender", "bot")
          .ilike("content", "🚀 Acesso rápido e simples%");
      }
      if (bot["profile_enabled"] === false) {
        await db
          .from("messages")
          .delete()
          .eq("sender", "bot")
          .ilike("content", "🔥 GHOST XITS | OFICIAL%");
      }
    }

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

    const { data: purchase } = await db
      .from("purchase_events")
      .select("id, session_id, plan_id, status, created_at")
      .eq("id", data.id)
      .maybeSingle();

    if (!purchase) throw new Error("Compra não encontrada.");
    if (purchase.status === "confirmed") return { ok: true, alreadyConfirmed: true };

    let couponRedemption: Record<string, unknown> | null = null;
    if (purchase.session_id && purchase.plan_id) {
      const { data: appliedRows } = await db
        .from("visitor_events")
        .select("metadata, created_at")
        .eq("session_id", purchase.session_id)
        .eq("event_type", "coupon_applied")
        .gte("created_at", purchase.created_at)
        .order("created_at", { ascending: false })
        .limit(20);

      const applied = (appliedRows ?? []).find((row) => {
        const metadata = (row.metadata ?? {}) as Record<string, unknown>;
        return String(metadata.plan_id ?? "") === String(purchase.plan_id);
      });

      if (applied) {
        const metadata = (applied.metadata ?? {}) as Record<string, unknown>;
        const couponId = String(metadata.coupon_id ?? "");
        if (couponId) {
          const { data: settingsRow } = await db
            .from("site_settings")
            .select("value")
            .eq("key", "coupons")
            .maybeSingle();
          const rawCoupons = Array.isArray(settingsRow?.value) ? settingsRow.value : [];
          const coupon = rawCoupons.find((item) => {
            const row = item as Record<string, unknown>;
            return String(row.id ?? "") === couponId;
          }) as Record<string, unknown> | undefined;

          const maxUses = Number(coupon?.max_uses);
          const { count } = await db
            .from("visitor_events")
            .select("id", { count: "exact", head: true })
            .eq("event_type", "coupon_redeemed")
            .contains("metadata", { coupon_id: couponId });

          if (coupon && Number.isFinite(maxUses) && maxUses > 0 && (count ?? 0) >= maxUses) {
            throw new Error("Este cupom atingiu o limite de usos antes da confirmação.");
          }

          couponRedemption = {
            coupon_id: couponId,
            code: String(metadata.code ?? coupon?.code ?? ""),
            plan_id: String(purchase.plan_id),
            discount_percent: Number(metadata.discount_percent ?? coupon?.discount_percent ?? 0),
            purchase_id: purchase.id,
          };
        }
      }
    }

    const { data: confirmed, error } = await db
      .from("purchase_events")
      .update({
        status: "confirmed",
        confirmed_at: new Date().toISOString(),
        confirmed_by: userId,
        note: data.note ?? null,
      })
      .eq("id", data.id)
      .neq("status", "confirmed")
      .select("id")
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!confirmed?.id) return { ok: true, alreadyConfirmed: true };

    if (couponRedemption) {
      const { error: redemptionError } = await db.from("visitor_events").insert({
        session_id: purchase.session_id,
        event_type: "coupon_redeemed",
        metadata: couponRedemption,
      });
      if (redemptionError) {
        await db
          .from("purchase_events")
          .update({ status: "checkout_started", confirmed_at: null, confirmed_by: null, note: null })
          .eq("id", data.id);
        throw new Error(redemptionError.message);
      }
    }

    await audit(db, userId, "confirm_purchase", `purchase:${data.id}`, {
      coupon_id: couponRedemption?.coupon_id ?? null,
    });
    return { ok: true, couponUsed: Boolean(couponRedemption) };
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

// ------------------------------------------------------------------ Stripe

async function stripeFetch<T>(path: string, init?: { method?: string; form?: Record<string, string> }): Promise<T> {
  const key = process.env['STRIPE_SECRET_KEY'];
  if (!key) throw new Error("Stripe não conectado. Configure o segredo STRIPE_SECRET_KEY.");
  const res = await fetch(`https://api.stripe.com${path}`, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${key}`,
      ...(init?.form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    ...(init?.form ? { body: new URLSearchParams(init.form).toString() } : {}),
  });
  const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
  if (!res.ok) throw new Error(body?.error?.message ?? `Erro Stripe (${res.status})`);
  return body as T;
}

type StripeList<T> = { data?: T[] };
type StripeCharge = {
  id: string;
  amount: number;
  amount_refunded: number;
  currency: string;
  created: number;
  status: string;
  refunded: boolean;
  paid: boolean;
  description?: string | null;
  receipt_url?: string | null;
};
type StripePayout = { id: string; amount: number; currency: string; status: string; arrival_date: number; created: number; method?: string };
type StripeBalanceAmount = { amount: number; currency: string };

export const getStripeOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireOwner(context);
    const key = process.env['STRIPE_SECRET_KEY'] ?? "";
    const testMode = !key.startsWith("sk_live_");

    const balance = await stripeFetch<{ available?: StripeBalanceAmount[]; pending?: StripeBalanceAmount[] }>("/v1/balance");
    const charges = await stripeFetch<StripeList<StripeCharge>>("/v1/charges?limit=100");
    const payouts = await stripeFetch<StripeList<StripePayout>>("/v1/payouts?limit=50");

    let manualPayouts = false;
    try {
      const settings = await stripeFetch<{ payouts?: { schedule?: { interval?: string } } }>("/v1/balance_settings");
      manualPayouts = settings?.payouts?.schedule?.interval === "manual";
    } catch {
      manualPayouts = false;
    }

    const sum = (list?: StripeBalanceAmount[]) =>
      (list ?? []).filter((a) => a.currency === "brl").reduce((t, a) => t + a.amount, 0);

    const all = charges.data ?? [];
    const succeeded = all.filter((c) => c.status === "succeeded" && c.paid);
    const netTotal = succeeded.reduce((t, c) => t + (c.amount - (c.amount_refunded ?? 0)), 0);
    const grossTotal = succeeded.reduce((t, c) => t + c.amount, 0);

    const byDay = new Map<string, number>();
    for (const c of succeeded) {
      const d = new Date(c.created * 1000).toISOString().slice(0, 10);
      byDay.set(d, (byDay.get(d) ?? 0) + (c.amount - (c.amount_refunded ?? 0)));
    }
    let bestDay: { date: string; amount: number } | null = null;
    for (const [date, amount] of byDay) if (!bestDay || amount > bestDay.amount) bestDay = { date, amount };

    const biggest = succeeded.reduce<StripeCharge | null>((m, c) => (!m || c.amount > m.amount ? c : m), null);
    const latest = succeeded.reduce<StripeCharge | null>((m, c) => (!m || c.created > m.created ? c : m), null);

    return {
      testMode,
      manualPayouts,
      availableBrl: sum(balance.available),
      pendingBrl: sum(balance.pending),
      approvedCount: succeeded.length,
      totalCount: all.length,
      receivedBrl: netTotal,
      grossBrl: grossTotal,
      averageTicket: succeeded.length ? Math.round(netTotal / succeeded.length) : 0,
      bestDay,
      biggest: biggest ? { amount: biggest.amount, created: biggest.created } : null,
      latest: latest ? { amount: latest.amount, created: latest.created } : null,
      charges: all.slice(0, 25).map((c) => ({
        id: c.id,
        amount: c.amount,
        refunded: c.amount_refunded ?? 0,
        status: c.status,
        created: c.created,
        currency: c.currency,
        description: c.description ?? null,
      })),
      payouts: (payouts.data ?? []).map((p) => ({
        id: p.id,
        amount: p.amount,
        currency: p.currency,
        status: p.status,
        arrival_date: p.arrival_date,
        created: p.created,
      })),
    };
  });

export const createStripeTestCharge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { amountCents: number; origin: string }) => input)
  .handler(async ({ data, context }) => {
    const { db, userId } = await requireOwner(context);
    const amount = Math.round(Number(data.amountCents));
    if (!Number.isFinite(amount) || amount < 50) throw new Error("Valor mínimo é R$ 0,50.");
    let origin: string;
    try {
      const u = new URL(data.origin);
      if (u.protocol !== "https:" && u.hostname !== "localhost") throw new Error("bad");
      origin = u.origin;
    } catch {
      throw new Error("Origem inválida.");
    }
    const session = await stripeFetch<{ id: string; url?: string }>("/v1/checkout/sessions", {
      method: "POST",
      form: {
        mode: "payment",
        success_url: `${origin}/owner/dashboard?stripe=success`,
        cancel_url: `${origin}/owner/dashboard?stripe=cancel`,
        "line_items[0][quantity]": "1",
        "line_items[0][price_data][currency]": "brl",
        "line_items[0][price_data][unit_amount]": String(amount),
        "line_items[0][price_data][product_data][name]": "Cobrança de teste OWNER",
      },
    });
    await audit(db, userId, "stripe_test_charge", "stripe", { amount, id: session.id });
    return { url: session.url ?? null };
  });

export const createStripePayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { amountCents: number }) => input)
  .handler(async ({ data, context }) => {
    const { db, userId } = await requireOwner(context);
    const amount = Math.round(Number(data.amountCents));
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("Valor inválido.");
    const payout = await stripeFetch<{ id: string; status: string }>("/v1/payouts", {
      method: "POST",
      form: { amount: String(amount), currency: "brl" },
    });
    await audit(db, userId, "stripe_payout", "stripe", { amount, id: payout.id });
    return { id: payout.id, status: payout.status };
  });

