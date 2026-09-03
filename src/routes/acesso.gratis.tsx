import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Gem, ImagePlus, Loader2, Send } from "lucide-react";
import { AccessShell } from "@/components/site/AccessShell";
import {
  markWentToPaid,
  pollChat,
  sendChatImage,
  sendChatMessage,
  startChat,
  trackEvent,
} from "@/lib/public.functions";
import type { ChatMessage } from "@/lib/site-config";
import { getSessionId, greetingKey } from "@/lib/session";

export const Route = createFileRoute("/acesso/gratis")({
  head: () => ({
    meta: [
      { title: "Acesso grátis | FF 2022 Elite" },
      {
        name: "description",
        content:
          "Atendimento guiado do FF 2022 Elite: siga o passo a passo no chat e envie o print para concluir o acesso grátis.",
      },
      { property: "og:title", content: "Acesso grátis | FF 2022 Elite" },
      {
        property: "og:description",
        content: "Siga o passo a passo no chat e envie o print para concluir o acesso grátis.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AcessoGratisPage,
});

function AcessoGratisPage() {
  const start = useServerFn(startChat);
  const send = useServerFn(sendChatMessage);
  const sendImage = useServerFn(sendChatImage);
  const poll = useServerFn(pollChat);
  const wentToPaid = useServerFn(markWentToPaid);
  const track = useServerFn(trackEvent);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [booting, setBooting] = useState(true);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const scrollToEnd = useCallback(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  useEffect(() => {
    let alive = true;
    const sessionId = getSessionId();
    if (!sessionId) return;

    void track({ data: { sessionId, eventType: "free_access" } }).catch(() => {});
    void track({ data: { sessionId, eventType: "chat_started" } }).catch(() => {});

    start({ data: { sessionId, greeting: greetingKey() } })
      .then((res) => {
        if (!alive) return;
        setMessages(res.messages);
      })
      .catch(() => {
        if (alive) setError("Não foi possível iniciar o atendimento. Recarregue a página.");
      })
      .finally(() => {
        if (alive) setBooting(false);
      });

    const timer = window.setInterval(() => {
      poll({ data: { sessionId } })
        .then((res) => {
          if (alive && res.messages.length) setMessages(res.messages);
        })
        .catch(() => {});
    }, 8000);

    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [start, poll, track]);

  useEffect(() => {
    scrollToEnd();
  }, [messages, scrollToEnd]);

  const onSend = async () => {
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await send({ data: { sessionId: getSessionId(), content } });
      setText("");
      setMessages(res.messages);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível enviar sua mensagem.");
    } finally {
      setSending(false);
    }
  };

  const onPickImage = async (file: File) => {
    setSending(true);
    setError(null);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Falha ao ler o arquivo."));
        reader.readAsDataURL(file);
      });
      const res = await sendImage({
        data: { sessionId: getSessionId(), fileName: file.name, dataUrl },
      });
      setMessages(res.messages);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível enviar a imagem.");
    } finally {
      setSending(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <AccessShell>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-primary-glow">Acesso grátis</p>
          <h1 className="mt-3 font-display text-2xl font-bold sm:text-3xl">Atendimento guiado</h1>
        </div>
        <Link
          to="/acesso/pago"
          onClick={() => {
            void wentToPaid({ data: { sessionId: getSessionId() } }).catch(() => {});
          }}
          className="glow-hover inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 font-display text-xs font-bold text-primary-foreground"
          style={{ background: "var(--gradient-primary)" }}
        >
          <Gem size={14} />
          Quero ver o acesso pago
        </Link>
      </div>

      <section
        className="glass mt-6 flex h-[68vh] min-h-[420px] flex-col overflow-hidden rounded-3xl"
        style={{ boxShadow: "var(--shadow-elegant)" }}
      >
        <div ref={listRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-6">
          {booting ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 size={26} className="animate-spin text-primary-glow" />
            </div>
          ) : (
            messages.map((m) => {
              const mine = m.sender === "user";
              return (
                <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[86%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap sm:max-w-[70%] ${
                      mine ? "text-primary-foreground" : "border border-border/60 bg-secondary/60"
                    }`}
                    style={mine ? { background: "var(--gradient-primary)" } : undefined}
                  >
                    {m.image_url && (
                      <img
                        src={m.image_url}
                        alt="Print enviado"
                        className="mb-2 max-h-64 w-full rounded-xl object-contain"
                      />
                    )}
                    {m.content}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {error && (
          <p className="border-t border-border/60 px-5 py-2 text-xs text-primary-glow">{error}</p>
        )}

        <div className="flex items-end gap-2 border-t border-border/60 p-3 sm:p-4">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void onPickImage(file);
            }}
          />
          <button
            type="button"
            aria-label="Enviar print"
            onClick={() => fileRef.current?.click()}
            disabled={sending}
            className="grid size-11 shrink-0 place-items-center rounded-2xl border border-border/60 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
          >
            <ImagePlus size={18} />
          </button>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void onSend();
              }
            }}
            rows={1}
            placeholder="Escreva sua mensagem..."
            className="max-h-32 min-h-11 flex-1 resize-none rounded-2xl border border-border/60 bg-background/60 px-4 py-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary/60"
          />
          <button
            type="button"
            aria-label="Enviar mensagem"
            onClick={() => void onSend()}
            disabled={sending || !text.trim()}
            className="glow-hover grid size-11 shrink-0 place-items-center rounded-2xl text-primary-foreground disabled:opacity-50"
            style={{ background: "var(--gradient-primary)" }}
          >
            {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </div>
      </section>
    </AccessShell>
  );
}
