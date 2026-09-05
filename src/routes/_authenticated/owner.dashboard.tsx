import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { OwnerShell, Panel } from "@/components/owner/OwnerShell";
import { getDashboard, listPixKeys, createPixEvpKey } from "@/lib/owner.functions";
import { Eye, EyeOff, Loader2, Copy, Check } from "lucide-react";


export const Route = createFileRoute("/_authenticated/owner/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard do proprietário | FF 2022 Elite" },
      { name: "description", content: "Métricas reais de visitantes, chats e compras do FF 2022 Elite." },
      { property: "og:title", content: "Dashboard do proprietário | FF 2022 Elite" },
      { property: "og:description", content: "Métricas reais do fluxo de acesso do FF 2022 Elite." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: DashboardPage,
});

type Data = Awaited<ReturnType<typeof getDashboard>>;

const LABELS: [keyof Data["metrics"], string][] = [
  ["site_visit", "Visitantes"],
  ["access_flow", "Liberar acesso"],
  ["free_access", "Acesso grátis"],
  ["paid_access", "Acesso pago"],
  ["chat_started", "Chats iniciados"],
  ["conversations", "Conversas"],
  ["messages", "Mensagens recebidas"],
  ["prints", "Prints enviados"],
  ["screenshot_uploaded", "Uploads de print"],
  ["checkout_clicks", "Cliques em comprar"],
  ["checkout_started", "Checkouts iniciados"],
  ["confirmed", "Compras confirmadas"],
  ["unread", "Não lidas"],
  ["events_total", "Eventos totais"],
];

type PixState = Awaited<ReturnType<typeof listPixKeys>>;

function AsaasPixCard() {
  const [state, setState] = useState<PixState | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () =>
    listPixKeys()
      .then(setState)
      .catch((e) => setErr(e instanceof Error ? e.message : "Falha ao consultar as chaves Pix."));

  useEffect(() => {
    void load();
  }, []);

  const active = state?.keys.find((k) => k.status === "ACTIVE") ?? null;

  return (
    <Panel title="Chave Pix do Dashboard">
      {err && <p className="text-sm text-destructive">{err}</p>}
      {!state && !err && <Loader2 className="animate-spin text-muted-foreground" size={16} />}
      {state && !state.connected && (
        <p className="text-sm text-muted-foreground">
          Asaas não conectado. Adicione o segredo <code className="font-mono">ASAAS_API_KEY</code> nas
          configurações do projeto para gerar chaves Pix.
        </p>
      )}
      {state?.connected && (
        <div className="space-y-3">
          {active ? (
            <div className="rounded-xl border border-border/60 bg-card/40 p-3">
              <p className="break-all font-mono text-xs">{active.key ?? active.id}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {active.type ?? "EVP"} · {active.status}
              </p>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">Nenhuma chave Pix ativa.</p>
              <button
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  setErr(null);
                  createPixEvpKey()
                    .then(() => load())
                    .catch((e) => setErr(e instanceof Error ? e.message : "Falha ao gerar a chave."))
                    .finally(() => setBusy(false));
                }}
                className="inline-flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2 text-xs disabled:opacity-60"
              >
                {busy && <Loader2 className="animate-spin" size={13} />}
                Gerar chave aleatória
              </button>
            </>
          )}
        </div>
      )}
    </Panel>
  );
}

function DashboardPage() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getDashboard()
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e instanceof Error ? e.message : "Falha ao carregar."));
    return () => {
      alive = false;
    };
  }, []);


  return (
    <OwnerShell title="Dashboard">
      {error && (
        <p className="mb-5 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm">{error}</p>
      )}
      {!data && !error && (
        <div className="grid place-items-center py-16 text-muted-foreground">
          <Loader2 className="animate-spin" />
        </div>
      )}

      <div className="mb-6">
        <AsaasPixCard />
      </div>



      {data && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {LABELS.map(([key, label]) => (
              <div key={key} className="glass rounded-2xl p-4">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="mt-1 font-display text-2xl font-bold">{data.metrics[key]}</p>
              </div>
            ))}
          </div>

          <Panel title="Atividade recente">
            {data.recent.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum evento registrado ainda.</p>
            ) : (
              <ul className="divide-y divide-border/50 text-sm">
                {data.recent.map((r, i) => (
                  <li key={i} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span className="font-medium">{r.event_type}</span>
                    <span className="truncate text-xs text-muted-foreground">{r.session_id}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleString("pt-BR")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Chaves Pix por plano">
            <ul className="space-y-3">
              {data.pix.map((p) => {
                const show = revealed[p.id] === true;
                return (
                  <li key={p.id} className="rounded-xl border border-border/60 bg-card/40 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-medium">
                        {p.name} · {p.price} {p.active ? "" : "· inativo"}
                      </span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setRevealed((s) => ({ ...s, [p.id]: !show }))}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 px-2.5 py-1.5 text-xs"
                        >
                          {show ? <EyeOff size={13} /> : <Eye size={13} />}
                          {show ? "Ocultar" : "Revelar"}
                        </button>
                        {show && p.payload && (
                          <button
                            onClick={() => {
                              void navigator.clipboard.writeText(p.payload);
                              setCopied(p.id);
                              setTimeout(() => setCopied(null), 1500);
                            }}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 px-2.5 py-1.5 text-xs"
                          >
                            {copied === p.id ? <Check size={13} /> : <Copy size={13} />}
                            Copiar
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="mt-2 break-all font-mono text-[11px] text-muted-foreground">
                      {p.payload
                        ? show
                          ? p.payload
                          : "•".repeat(Math.min(64, p.payload.length))
                        : "Nenhuma chave Pix configurada."}
                    </p>
                  </li>
                );
              })}
            </ul>
          </Panel>
        </div>
      )}
    </OwnerShell>
  );
}
