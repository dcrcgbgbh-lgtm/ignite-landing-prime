import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { OwnerShell, Panel } from "@/components/owner/OwnerShell";
import {
  getDashboard,
  getStripeOverview,
  createStripeTestCharge,
  createStripePayout,
} from "@/lib/owner.functions";
import { Eye, EyeOff, Loader2, Copy, Check, RefreshCw, CalendarDays, WalletCards, TrendingUp, Clock3, Sparkles } from "lucide-react";



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

type StripeState = Awaited<ReturnType<typeof getStripeOverview>>;

const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dt = (unix: number) => new Date(unix * 1000).toLocaleString("pt-BR");

function StripeSection() {
  const [s, setS] = useState<StripeState | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState("5,00");
  const [busy, setBusy] = useState(false);
  const [payoutBusy, setPayoutBusy] = useState(false);
  const alive = useRef(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await getStripeOverview();
      if (alive.current) {
        setS(r);
        setErr(null);
      }
    } catch (e) {
      if (alive.current) setErr(e instanceof Error ? e.message : "Falha ao consultar a Stripe.");
    } finally {
      if (alive.current) setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    alive.current = true;
    void load();
    const t = setInterval(() => void load(), 15000);
    return () => {
      alive.current = false;
      clearInterval(t);
    };
  }, [load]);

  const cards: [string, string][] = s
    ? [
        ["Vendas aprovadas", String(s.approvedCount)],
        ["Total de vendas", String(s.totalCount)],
        ["Valor recebido", brl(s.receivedBrl)],
        ["Saldo disponível", brl(s.availableBrl)],
        ["Saldo pendente", brl(s.pendingBrl)],
        ["Melhor dia", s.bestDay ? `${new Date(s.bestDay.date).toLocaleDateString("pt-BR")} · ${brl(s.bestDay.amount)}` : "—"],
      ]
    : [];

  return (
    <div className="space-y-6">
      <Panel title="Stripe">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {s?.testMode && (
            <span className="rounded-full border border-amber-500/50 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-400">
              MODO TESTE — valores não são dinheiro real
            </span>
          )}
          <button
            onClick={() => void load()}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-border/60 px-2.5 py-1.5 text-xs"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Atualizar
          </button>
        </div>
        {err && <p className="text-sm text-destructive">{err}</p>}
        {!s && !err && <Loader2 className="animate-spin text-muted-foreground" size={16} />}
        {s && (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {cards.map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-border/60 bg-card/40 p-4">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="mt-1 font-display text-xl font-bold">{value}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
              <p>Maior venda: {s.biggest ? brl(s.biggest.amount) : "—"}</p>
              <p>Ticket médio: {brl(s.averageTicket)}</p>
              <p>Venda mais recente: {s.latest ? `${brl(s.latest.amount)} · ${dt(s.latest.created)}` : "—"}</p>
            </div>
          </>
        )}
      </Panel>

      {s && (
        <Panel title="Histórico de pagamentos">
          {s.charges.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum pagamento registrado.</p>
          ) : (
            <ul className="divide-y divide-border/50 text-sm">
              {s.charges.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="font-medium">{brl(c.amount)}</span>
                  <span className="text-xs text-muted-foreground">
                    {c.status}
                    {c.refunded > 0 ? ` · reembolsado ${brl(c.refunded)}` : ""}
                  </span>
                  <span className="text-xs text-muted-foreground">{dt(c.created)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}

      {s && (
        <Panel title="Histórico de retiradas">
          {!s.manualPayouts && (
            <p className="mb-3 text-xs text-muted-foreground">Repasses automáticos pela Stripe.</p>
          )}
          {s.manualPayouts && s.availableBrl > 0 && (
            <button
              disabled={payoutBusy}
              onClick={() => {
                if (!window.confirm(`Enviar ${brl(s.availableBrl)} para a conta bancária padrão da Stripe?`)) return;
                setPayoutBusy(true);
                createStripePayout({ data: { amountCents: s.availableBrl } })
                  .then(() => load())
                  .catch((e: unknown) => setErr(e instanceof Error ? e.message : "Falha ao solicitar o repasse."))
                  .finally(() => setPayoutBusy(false));
              }}
              className="mb-3 inline-flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2 text-xs disabled:opacity-60"
            >
              {payoutBusy && <Loader2 className="animate-spin" size={13} />}
              Sacar saldo disponível
            </button>
          )}
          {s.payouts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum repasse registrado.</p>
          ) : (
            <ul className="divide-y divide-border/50 text-sm">
              {s.payouts.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="font-medium">{brl(p.amount)}</span>
                  <span className="text-xs text-muted-foreground">{p.status}</span>
                  <span className="text-xs text-muted-foreground">{dt(p.arrival_date)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}

      <Panel title="Cobrança de teste Stripe">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            placeholder="R$ 5,00"
            className="w-32 rounded-lg border border-border/60 bg-card/40 px-3 py-2 text-sm"
          />
          <button
            disabled={busy}
            onClick={() => {
              const cents = Math.round(Number(amount.replace(/\./g, "").replace(",", ".")) * 100);
              if (!Number.isFinite(cents) || cents < 50) {
                setErr("Valor mínimo é R$ 0,50.");
                return;
              }
              setBusy(true);
              setErr(null);
              createStripeTestCharge({ data: { amountCents: cents, origin: window.location.origin } })
                .then((r) => {
                  if (r.url) window.open(r.url, "_blank", "noopener");
                })
                .catch((e: unknown) => setErr(e instanceof Error ? e.message : "Falha ao gerar a cobrança."))
                .finally(() => setBusy(false));
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2 text-xs disabled:opacity-60"
          >
            {busy && <Loader2 className="animate-spin" size={13} />}
            Gerar cobrança
          </button>
        </div>
      </Panel>
    </div>
  );
}

function DashboardPage() {
  const [data, setData] = useState<Data | null>(null);
  const [period, setPeriod] = useState<"today" | "month" | "all">("month");
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getDashboard({ data: { period } })
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e instanceof Error ? e.message : "Falha ao carregar."));
    return () => {
      alive = false;
    };
  }, []);


  return (
    <OwnerShell title="Dashboard">
      <div className="mb-7 overflow-hidden rounded-3xl border border-border/60 bg-card/50 p-5 shadow-[var(--shadow-elegant)] sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-semibold text-primary-glow">
              <Sparkles size={13} /> Painel financeiro
            </div>
            <h1 className="font-display text-2xl font-black tracking-tight sm:text-3xl">
              {new Date().getHours() < 12 ? "Bom dia" : new Date().getHours() < 18 ? "Boa tarde" : "Boa noite"} 👋
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">Visão geral do Premium Download Hub em tempo real.</p>
          </div>
          <div className="flex rounded-2xl border border-border/60 bg-background/50 p-1">
            {([["today","Hoje",CalendarDays],["month","Este mês",TrendingUp],["all","Tudo",WalletCards]] as const).map(([value,label,Icon]) => (
              <button key={value} onClick={() => setPeriod(value)} className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all duration-300 ${period === value ? "bg-primary/15 text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                <Icon size={14} /> {label}
              </button>
            ))}
          </div>
        </div>
      </div>
      {error && (
        <p className="mb-5 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm">{error}</p>
      )}
      {!data && !error && (
        <div className="grid place-items-center py-16 text-muted-foreground">
          <Loader2 className="animate-spin" />
        </div>
      )}

      <div className="mb-6">
        <StripeSection />
      </div>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Saldo disponível", "Consulte o gateway conectado", WalletCards],
          ["Saldo pendente", "Aguardando liquidação", Clock3],
          ["Melhor dia", "Maior faturamento registrado", TrendingUp],
          ["Status", "Pronto para integrar SigiloPay", Sparkles],
        ].map(([title,sub,Icon], i) => (
          <div key={String(title)} className="group rounded-2xl border border-border/60 bg-card/40 p-4 transition-all duration-500 hover:-translate-y-1 hover:border-primary/30 hover:shadow-[var(--shadow-glow)]" style={{ animation: `scale-in .35s ease-out ${i * 70}ms both` }}>
            <Icon size={18} className="text-primary-glow" />
            <p className="mt-4 text-sm font-bold">{title}</p>
            <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
          </div>
        ))}
      </div>
      <Panel title="SigiloPay">
        <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card/40 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold">Gateway de cobrança PIX</p>
            <p className="mt-1 text-xs text-muted-foreground">Estrutura preparada para conectar a API SigiloPay sem expor chave secreta no navegador.</p>
          </div>
          <a href="https://www.sigilopay.com/" target="_blank" rel="noreferrer" className="inline-flex items-center justify-center rounded-xl border border-border/60 px-4 py-2 text-xs font-semibold transition hover:border-primary/50 hover:text-primary-glow">
            Abrir SigiloPay
          </a>
        </div>
      </Panel>




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
