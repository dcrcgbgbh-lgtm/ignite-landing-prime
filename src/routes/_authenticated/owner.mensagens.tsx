import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { OwnerShell, Panel } from "@/components/owner/OwnerShell";
import {
  listConversations,
  getConversation,
  ownerReply,
  updateConversation,
  deleteMessage,
} from "@/lib/owner.functions";
import { STAGE_LABELS } from "@/lib/site-config";
import { Loader2, Search, Send, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/owner/mensagens")({
  head: () => ({
    meta: [
      { title: "Central de mensagens | FF 2022 Elite" },
      { name: "description", content: "Conversas do acesso grátis, prints e respostas do proprietário." },
      { property: "og:title", content: "Central de mensagens | FF 2022 Elite" },
      { property: "og:description", content: "Conversas e prints do fluxo de acesso grátis." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: MessagesPage,
});

type ListData = Awaited<ReturnType<typeof listConversations>>;
type ConvData = Awaited<ReturnType<typeof getConversation>>;

const FILTERS: [string, string][] = [
  ["all", "Todas"],
  ["unread", "Não lidas"],
  ["aguardando_print", "Aguardando print"],
  ["print_recebido", "Print recebido"],
  ["erro_relatado", "Erro relatado"],
  ["foi_para_pago", "Foi para o pago"],
  ["finalizadas", "Finalizadas"],
  ["archived", "Arquivadas"],
];

function MessagesPage() {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [list, setList] = useState<ListData | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [conv, setConv] = useState<ConvData | null>(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setList(await listConversations({ data: { filter, search } }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar conversas.");
    }
  }, [filter, search]);

  useEffect(() => {
    void load();
  }, [load]);

  const openConv = useCallback(async (id: string) => {
    setOpenId(id);
    setConv(null);
    try {
      setConv(await getConversation({ data: { id } }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao abrir conversa.");
    }
  }, []);

  const act = async (
    id: string,
    action: "read" | "close" | "reopen" | "archive" | "unarchive" | "delete",
  ) => {
    if (action === "delete" && !window.confirm("Excluir esta conversa e todas as mensagens?")) return;
    setBusy(true);
    try {
      await updateConversation({ data: { id, action } });
      if (action === "delete") {
        setOpenId(null);
        setConv(null);
      } else if (openId) {
        await openConv(openId);
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha na ação.");
    } finally {
      setBusy(false);
    }
  };

  const send = async () => {
    if (!openId || !reply.trim()) return;
    setBusy(true);
    try {
      await ownerReply({ data: { id: openId, content: reply } });
      setReply("");
      await openConv(openId);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao responder.");
    } finally {
      setBusy(false);
    }
  };

  const removeMessage = async (messageId: string) => {
    if (!window.confirm("Excluir esta mensagem?")) return;
    await deleteMessage({ data: { messageId } });
    if (openId) await openConv(openId);
  };

  return (
    <OwnerShell title="Central de mensagens">
      {error && (
        <p className="mb-4 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm">{error}</p>
      )}

      <div className="mb-5 flex flex-wrap items-center gap-2">
        {FILTERS.map(([value, label]) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={`rounded-xl border px-3 py-2 text-xs transition-colors ${
              filter === value
                ? "border-primary/60 bg-primary/15 text-foreground"
                : "border-border/60 text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
        <span className="ml-auto rounded-xl border border-border/60 px-3 py-2 text-xs text-muted-foreground">
          Não lidas: <strong className="text-foreground">{list?.totalUnread ?? 0}</strong>
        </span>
      </div>

      <div className="mb-5 flex items-center gap-2 rounded-xl border border-border/60 bg-card/40 px-3">
        <Search size={15} className="text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por sessão..."
          className="w-full bg-transparent py-2.5 text-sm outline-none"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <Panel title="Conversas">
          {!list ? (
            <div className="grid place-items-center py-10 text-muted-foreground">
              <Loader2 className="animate-spin" />
            </div>
          ) : list.conversations.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma conversa neste filtro.</p>
          ) : (
            <ul className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
              {list.conversations.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => void openConv(c.id)}
                    className={`w-full rounded-xl border p-3 text-left transition-colors ${
                      openId === c.id ? "border-primary/60 bg-primary/10" : "border-border/60 hover:bg-card/60"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-medium">{c.session_id}</span>
                      {c.unread_count > 0 && (
                        <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                          {c.unread_count}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {c.last_message ?? "Sem mensagens"}
                    </p>
                    <p className="mt-1.5 text-[11px] text-muted-foreground">
                      {STAGE_LABELS[c.stage] ?? c.stage} · {c.message_count} msgs · {c.print_count} prints
                      {c.last_message_at
                        ? ` · ${new Date(c.last_message_at).toLocaleString("pt-BR")}`
                        : ""}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Conversa">
          {!openId ? (
            <p className="text-sm text-muted-foreground">Selecione uma conversa à esquerda.</p>
          ) : !conv ? (
            <div className="grid place-items-center py-10 text-muted-foreground">
              <Loader2 className="animate-spin" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <button onClick={() => void act(openId, "read")} disabled={busy} className="owner-chip">
                  Marcar lida
                </button>
                <button
                  onClick={() => void act(openId, conv.conversation.status === "closed" ? "reopen" : "close")}
                  disabled={busy}
                  className="owner-chip"
                >
                  {conv.conversation.status === "closed" ? "Reabrir" : "Finalizar"}
                </button>
                <button
                  onClick={() => void act(openId, conv.conversation.archived ? "unarchive" : "archive")}
                  disabled={busy}
                  className="owner-chip"
                >
                  {conv.conversation.archived ? "Desarquivar" : "Arquivar"}
                </button>
                <button
                  onClick={() => void act(openId, "delete")}
                  disabled={busy}
                  className="owner-chip text-destructive"
                >
                  Excluir conversa
                </button>
              </div>

              <div className="max-h-[50vh] space-y-3 overflow-y-auto rounded-xl border border-border/50 bg-black/20 p-3">
                {conv.messages.map((m) => (
                  <div
                    key={m.id}
                    className={`group max-w-[85%] rounded-2xl p-3 text-sm ${
                      m.sender === "user"
                        ? "ml-auto bg-primary/20"
                        : m.sender === "owner"
                          ? "ml-auto bg-card/70"
                          : "bg-card/50"
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{m.content}</p>
                    {m.image_url && (
                      <a href={m.image_url} target="_blank" rel="noreferrer">
                        <img
                          src={m.image_url}
                          alt="Print enviado pelo usuário"
                          loading="lazy"
                          className="mt-2 max-h-64 rounded-xl border border-border/50"
                        />
                      </a>
                    )}
                    <div className="mt-1.5 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                      <span>
                        {m.sender} · {new Date(m.created_at).toLocaleString("pt-BR")}
                      </span>
                      <button
                        onClick={() => void removeMessage(m.id)}
                        className="opacity-0 transition-opacity group-hover:opacity-100"
                        aria-label="Excluir mensagem"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-end gap-2">
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  rows={2}
                  placeholder="Responder..."
                  className="w-full resize-none rounded-xl border border-border/60 bg-card/50 px-3 py-2.5 text-sm outline-none focus:border-primary/60"
                />
                <button
                  onClick={() => void send()}
                  disabled={busy || !reply.trim()}
                  className="btn-glow rounded-xl px-4 py-3 text-sm font-bold text-primary-foreground disabled:opacity-50"
                  style={{ background: "var(--gradient-primary)" }}
                >
                  <Send size={15} />
                </button>
              </div>
            </div>
          )}
        </Panel>
      </div>
    </OwnerShell>
  );
}
