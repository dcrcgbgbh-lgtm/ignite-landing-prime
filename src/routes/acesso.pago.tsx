import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, Crown, Flame, Loader2 } from "lucide-react";
import { AccessShell, AccessVideoCard } from "@/components/site/AccessShell";
import { PlanCheckoutModal } from "@/components/site/PlanCheckoutModal";
import { Reveal } from "@/components/site/ui";
import { getPublicConfig, trackEvent } from "@/lib/public.functions";
import { defaultSettings, type PlanConfig, type SiteSettings } from "@/lib/site-config";
import { getSessionId } from "@/lib/session";

export const Route = createFileRoute("/acesso/pago")({
  head: () => ({
    meta: [
      { title: "Acesso pago | Planos FF 2022 Elite" },
      {
        name: "description",
        content:
          "Escolha entre Elite Starter, Elite Premium e Elite VIP e finalize o pagamento via Pix com liberação rápida.",
      },
      { property: "og:title", content: "Acesso pago | Planos FF 2022 Elite" },
      {
        property: "og:description",
        content: "Planos Elite Starter, Elite Premium e Elite VIP com pagamento via Pix.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AcessoPagoPage,
});

function AcessoPagoPage() {
  const loadConfig = useServerFn(getPublicConfig);
  const track = useServerFn(trackEvent);
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [plans, setPlans] = useState<PlanConfig[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [checkout, setCheckout] = useState<PlanConfig | null>(null);

  useEffect(() => {
    let alive = true;
    loadConfig()
      .then((res) => {
        if (!alive) return;
        setSettings(res.settings);
        setPlans(res.plans);
      })
      .catch(() => {
        if (!alive) return;
        setSettings(defaultSettings);
        setError("Não foi possível carregar os planos agora. Tente recarregar a página.");
      });
    const sessionId = getSessionId();
    if (sessionId) void track({ data: { sessionId, eventType: "paid_access" } }).catch(() => {});
    return () => {
      alive = false;
    };
  }, [loadConfig, track]);

  const openCheckout = (plan: PlanConfig) => {
    void track({
      data: { sessionId: getSessionId(), eventType: "checkout_started", planId: plan.id },
    }).catch(() => {});
    const url = (plan.checkout_url ?? "").trim();
    if (url) {
      window.location.href = url;
      return;
    }
    setCheckout(plan);
  };

  const access = (settings ?? defaultSettings).access;

  return (
    <AccessShell>
      <Reveal>
        <p className="text-center text-xs uppercase tracking-[0.35em] text-primary-glow">
          Acesso pago
        </p>
        <h1 className="mt-4 text-center font-display text-3xl font-bold sm:text-4xl">
          Escolha o seu acesso
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-center text-sm text-muted-foreground">
          Veja como funciona no vídeo e selecione o plano ideal para você.
        </p>
      </Reveal>

      {!settings ? (
        <div className="mt-10 flex justify-center py-16">
          <Loader2 size={28} className="animate-spin text-primary-glow" />
        </div>
      ) : (
        <>
          <Reveal delay={120} className="mt-10">
            <AccessVideoCard access={access} />
          </Reveal>

          {error && (
            <p className="mt-6 rounded-2xl border border-border/60 p-3 text-center text-xs text-muted-foreground">
              {error}
            </p>
          )}

          <div className="mt-10 flex flex-col gap-6">
            {plans.map((plan, i) => (
              <Reveal key={plan.id} delay={i * 100}>
                <article
                  className="glass glow-hover relative flex flex-col rounded-3xl p-7 sm:p-8"
                  style={
                    plan.highlight
                      ? { boxShadow: "var(--shadow-glow), var(--shadow-elegant)" }
                      : undefined
                  }
                >
                  {plan.badge && (
                    <span
                      className="absolute -top-3 left-8 inline-flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-bold tracking-widest"
                      style={
                        plan.vip
                          ? { background: "var(--gradient-gold)", color: "oklch(0.15 0 0)" }
                          : {
                              background: "var(--gradient-primary)",
                              color: "var(--primary-foreground)",
                            }
                      }
                    >
                      {plan.vip ? <Crown size={12} /> : <Flame size={12} />}
                      {plan.badge}
                    </span>
                  )}

                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <h2 className="font-display text-xl font-bold">{plan.name}</h2>
                    <p className="flex items-baseline gap-1">
                      <span className="text-sm text-muted-foreground">R$</span>
                      <span
                        className={`font-display text-4xl font-extrabold ${
                          plan.vip ? "text-gold" : "text-foreground"
                        }`}
                      >
                        {plan.price}
                      </span>
                    </p>
                  </div>

                  <ul className="mt-6 space-y-3 text-sm text-muted-foreground">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-3">
                        <span
                          className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full"
                          style={{
                            background: plan.vip
                              ? "var(--gradient-gold)"
                              : "oklch(0.51 0.2 26.5 / 0.2)",
                          }}
                        >
                          <Check
                            size={12}
                            className={plan.vip ? "text-background" : "text-primary-glow"}
                            strokeWidth={3}
                          />
                        </span>
                        {f}
                      </li>
                    ))}
                  </ul>

                  <button
                    type="button"
                    onClick={() => openCheckout(plan)}
                    className="glow-hover mt-8 w-full rounded-2xl py-3.5 font-display text-sm font-bold"
                    style={
                      plan.vip
                        ? { background: "var(--gradient-gold)", color: "oklch(0.15 0 0)" }
                        : plan.highlight
                          ? {
                              background: "var(--gradient-primary)",
                              color: "var(--primary-foreground)",
                            }
                          : { background: "var(--secondary)", color: "var(--foreground)" }
                    }
                  >
                    {plan.cta}
                  </button>
                </article>
              </Reveal>
            ))}
          </div>
        </>
      )}

      <PlanCheckoutModal plan={checkout} onClose={() => setCheckout(null)} />
    </AccessShell>
  );
}
