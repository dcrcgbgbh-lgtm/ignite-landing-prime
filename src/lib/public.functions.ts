import { createServerFn } from "@tanstack/react-start";

import { mergeSettings, type ChatMessage, type PlanConfig, type SiteSettings } from "./site-config";

const BUCKET = "chat-prints";

type AdminClient = Awaited<
  typeof import("@/integrations/supabase/client.server")
>["supabaseAdmin"];

async function admin(): Promise<AdminClient> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function loadSettings(db: AdminClient): Promise<SiteSettings> {
  const { data } = await db.from("site_settings").select("key, value").eq("is_public", true);
  const raw: Record<string, unknown> = {};
  for (const row of data ?? []) raw[row.key] = row.value;
  return mergeSettings(raw);
}

async function signMessages(
  db: AdminClient,
  rows: Record<string, unknown>[],
): Promise<ChatMessage[]> {
  const out: ChatMessage[] = [];
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

async function listMessages(db: AdminClient, conversationId: string): Promise<ChatMessage[]> {
  const { data } = await db
    .from("messages")
    .select("id, sender, content, image_url, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  return signMessages(db, (data ?? []) as unknown as Record<string, unknown>[]);
}

async function touchConversation(
  db: AdminClient,
  conversationId: string,
  patch: { last_message: string; stage?: string | undefined; incrementUnread?: number },
) {
  let unread: number | undefined;
  if (patch.incrementUnread) {
    const { data } = await db
      .from("conversations")
      .select("unread_count")
      .eq("id", conversationId)
      .maybeSingle();
    unread = (data?.unread_count ?? 0) + patch.incrementUnread;
  }
  await db
    .from("conversations")
    .update({
      last_message: patch.last_message.slice(0, 200),
      last_message_at: new Date().toISOString(),
      ...(patch.stage ? { stage: patch.stage } : {}),
      ...(unread !== undefined ? { unread_count: unread } : {}),
    })
    .eq("id", conversationId);
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

// ---------------------------------------------------------------- public data

export const getPublicConfig = createServerFn({ method: "GET" }).handler(async () => {
  const db = await admin();
  const [settings, plansRes] = await Promise.all([
    loadSettings(db),
    db.from("plans").select("*").eq("active", true).order("sort_order", { ascending: true }),
  ]);
  const plans = ((plansRes.data ?? []) as unknown as Record<string, unknown>[]).map((p) => ({
    ...(p as unknown as PlanConfig),
    features: Array.isArray(p['features']) ? (p['features'] as string[]) : [],
  })) as PlanConfig[];
  return { settings, plans };
});

// ------------------------------------------------------------------- métricas

const EVENTS = [
  "site_visit",
  "access_flow",
  "free_access",
  "paid_access",
  "chat_started",
  "checkout_started",
  "screenshot_uploaded",
] as const;
type EventType = (typeof EVENTS)[number];

export const trackEvent = createServerFn({ method: "POST" })
  .inputValidator((input: { sessionId: string; eventType: EventType; planId?: string }) => {
    if (!input?.sessionId || typeof input.sessionId !== "string" || input.sessionId.length > 80) {
      throw new Error("Invalid session");
    }
    if (!EVENTS.includes(input.eventType)) throw new Error("Invalid event");
    return input;
  })
  .handler(async ({ data }) => {
    const db = await admin();
    await db.from("visitor_events").upsert(
      {
        session_id: data.sessionId,
        event_type: data.eventType,
        metadata: data.planId ? { plan_id: data.planId } : {},
      },
      { onConflict: "session_id,event_type", ignoreDuplicates: true },
    );

    if (data.eventType === "checkout_started" && data.planId) {
      const { data: plan } = await db
        .from("plans")
        .select("price")
        .eq("id", data.planId)
        .maybeSingle();
      await db.from("purchase_events").insert({
        session_id: data.sessionId,
        plan_id: data.planId,
        amount: plan?.price ?? null,
        status: "checkout_started",
      });
    }
    return { ok: true };
  });

// ----------------------------------------------------------------------- chat

function buildStepsMessage(settings: SiteSettings): string {
  const { steps_title, steps } = settings.bot_messages;
  const link = settings.free_access.tiktok_url;
  const lines = steps.map((s, i) => `${i + 1}. ${s}`).join("\n");
  return `${steps_title}\n\nAcesse pelo link abaixo:\n${link}\n\n✅ Passo a passo:\n${lines}`;
}

export const startChat = createServerFn({ method: "POST" })
  .inputValidator((input: { sessionId: string; greeting: "morning" | "afternoon" | "evening" }) => {
    if (!input?.sessionId) throw new Error("Sessão inválida");
    return input;
  })
  .handler(async ({ data }) => {
    const db = await admin();
    const settings = await loadSettings(db);

    let { data: conversation } = await db
      .from("conversations")
      .select("*")
      .eq("session_id", data.sessionId)
      .maybeSingle();

    if (!conversation) {
      const inserted = await db
        .from("conversations")
        .insert({ session_id: data.sessionId, stage: "entrou" })
        .select("*")
        .single();
      if (inserted.error) throw new Error(inserted.error.message);
      conversation = inserted.data;
    }

    if (conversation && !conversation.bootstrapped) {
      const bm = settings.bot_messages;
      const greeting =
        data.greeting === "morning"
          ? bm.greeting_morning
          : data.greeting === "afternoon"
            ? bm.greeting_afternoon
            : bm.greeting_evening;

      const autos = [
        { key: "greeting", content: greeting },
        { key: "welcome", content: bm.welcome },
        { key: "steps", content: buildStepsMessage(settings) },
        { key: "print_hint", content: settings.free_access.print_hint },
      ];

      const { data: existing } = await db
        .from("messages")
        .select("auto_key")
        .eq("conversation_id", conversation.id)
        .not("auto_key", "is", null);
      const seen = new Set((existing ?? []).map((m) => m.auto_key));

      const toInsert = autos
        .filter((a) => !seen.has(a.key))
        .map((a) => ({
          conversation_id: conversation!.id,
          sender: "bot" as const,
          content: a.content,
          auto_key: a.key,
          read_by_owner: true,
        }));
      if (toInsert.length) await db.from("messages").insert(toInsert);

      await db
        .from("conversations")
        .update({
          bootstrapped: true,
          stage: "aguardando_print",
          last_message: settings.free_access.print_hint,
          last_message_at: new Date().toISOString(),
        })
        .eq("id", conversation.id);
    }

    return {
      conversationId: conversation!.id,
      messages: await listMessages(db, conversation!.id),
      settings,
    };
  });

export const sendChatMessage = createServerFn({ method: "POST" })
  .inputValidator((input: { sessionId: string; content: string }) => {
    if (!input?.sessionId) throw new Error("Sessão inválida");
    const content = (input.content ?? "").trim();
    if (!content) throw new Error("Escreva uma mensagem antes de enviar.");
    if (content.length > 2000) throw new Error("Mensagem muito longa.");
    return { sessionId: input.sessionId, content };
  })
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: conversation } = await db
      .from("conversations")
      .select("id, stage")
      .eq("session_id", data.sessionId)
      .maybeSingle();
    if (!conversation) throw new Error("Conversa não encontrada. Recarregue a página.");

    const insert = await db
      .from("messages")
      .insert({ conversation_id: conversation.id, sender: "user", content: data.content });
    if (insert.error) throw new Error(insert.error.message);

    const settings = await loadSettings(db);
    const { data: rules } = await db
      .from("bot_rules")
      .select("keywords, response, ask_for_print, delay_ms")
      .eq("active", true)
      .order("priority", { ascending: true });

    const text = normalize(data.content);
    const match = (rules ?? []).find((r) =>
      (r.keywords ?? []).some((k) => k && text.includes(normalize(k))),
    );

    // Já enviou print nessa conversa?
    const { count: printCount } = await db
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("conversation_id", conversation.id)
      .not("image_url", "is", null);
    const hasPrint = (printCount ?? 0) > 0;

    const reply = match?.response ?? settings.bot_messages.fallback;
    const shouldAskPrint = !hasPrint && (match?.ask_for_print ?? !match);
    const askPrint = shouldAskPrint ? `\n\n${settings.bot_messages.ask_print}` : "";

    await db.from("messages").insert({
      conversation_id: conversation.id,
      sender: "bot",
      content: `${reply}${askPrint}`,
      read_by_owner: true,
    });

    const stage = match?.ask_for_print ? "erro_relatado" : conversation.stage;
    await touchConversation(db, conversation.id, {
      last_message: data.content,
      stage,
      incrementUnread: 1,
    });

    return {
      messages: await listMessages(db, conversation.id),
      delayMs: Math.min(Math.max(match?.delay_ms ?? 600, 0), 4000),
    };
  });

export const sendChatImage = createServerFn({ method: "POST" })
  .inputValidator((input: { sessionId: string; fileName: string; dataUrl: string }) => {
    if (!input?.sessionId) throw new Error("Sessão inválida");
    if (!input.dataUrl?.startsWith("data:image/")) throw new Error("Envie um arquivo de imagem.");
    if (input.dataUrl.length > 7_000_000) throw new Error("Imagem muito grande (máx. 5MB).");
    return input;
  })
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: conversation } = await db
      .from("conversations")
      .select("id")
      .eq("session_id", data.sessionId)
      .maybeSingle();
    if (!conversation) throw new Error("Conversa não encontrada. Recarregue a página.");

    const commaIndex = data.dataUrl.indexOf(",");
    const meta = data.dataUrl.slice(5, data.dataUrl.indexOf(";"));
    const bytes = Uint8Array.from(atob(data.dataUrl.slice(commaIndex + 1)), (c) => c.charCodeAt(0));
    const ext = (meta.split("/")[1] ?? "png").replace(/[^a-z0-9]/gi, "");
    const path = `${conversation.id}/${Date.now()}.${ext}`;

    const upload = await db.storage.from(BUCKET).upload(path, bytes, { contentType: meta });
    if (upload.error) throw new Error("Não foi possível enviar a imagem. Tente novamente.");

    await db.from("messages").insert({
      conversation_id: conversation.id,
      sender: "user",
      content: data.fileName?.slice(0, 120) ?? "",
      image_url: path,
    });

    const settings = await loadSettings(db);
    await db.from("messages").insert({
      conversation_id: conversation.id,
      sender: "bot",
      content: settings.bot_messages.image_received,
      read_by_owner: true,
    });

    await db.from("visitor_events").upsert(
      { session_id: data.sessionId, event_type: "screenshot_uploaded", metadata: {} },
      { onConflict: "session_id,event_type", ignoreDuplicates: true },
    );

    await touchConversation(db, conversation.id, {
      last_message: "📸 Print recebido",
      stage: "print_recebido",
      incrementUnread: 1,
    });

    return { messages: await listMessages(db, conversation.id) };
  });

export const pollChat = createServerFn({ method: "POST" })
  .inputValidator((input: { sessionId: string }) => {
    if (!input?.sessionId) throw new Error("Sessão inválida");
    return input;
  })
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: conversation } = await db
      .from("conversations")
      .select("id")
      .eq("session_id", data.sessionId)
      .maybeSingle();
    if (!conversation) return { messages: [] as ChatMessage[] };
    return { messages: await listMessages(db, conversation.id) };
  });

export const markWentToPaid = createServerFn({ method: "POST" })
  .inputValidator((input: { sessionId: string }) => {
    if (!input?.sessionId) throw new Error("Sessão inválida");
    return input;
  })
  .handler(async ({ data }) => {
    const db = await admin();
    await db
      .from("conversations")
      .update({ stage: "foi_para_pago" })
      .eq("session_id", data.sessionId);
    return { ok: true };
  });
