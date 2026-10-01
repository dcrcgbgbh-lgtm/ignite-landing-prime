import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Gem, Gift, Loader2 } from "lucide-react";
import { AccessShell, AccessVideoCard } from "@/components/site/AccessShell";
import { Reveal } from "@/components/site/ui";
import { getPublicConfig, trackEvent } from "@/lib/public.functions";
import { defaultSettings, type SiteSettings } from "@/lib/site-config";
import { getSessionId } from "@/lib/session";

export const Route = createFileRoute("/acesso/")({
  head: () => ({
    meta: [
      { title: "Liberar acesso | FF 2022 Elite" },
      {
        name: "description",
        content:
          "Assista à explicação em vídeo e escolha como liberar o seu acesso ao FF 2022 Elite: acesso grátis ou acesso pago.",
      },
      { property: "og:title", content: "Liberar acesso | FF 2022 Elite" },
      {
        property: "og:description",
        content: "Veja como funciona e escolha entre acesso grátis ou acesso pago.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AcessoPage,
});

function AcessoPage() {
  const loadConfig = useServerFn(getPublicConfig);
  const track = useServerFn(trackEvent);
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    loadConfig()
      .then((res) => {
        if (alive) setSettings(res.settings);
      })
      .catch(() => {
        if (alive) {
          setSettings(defaultSettings);
          setError("Não foi possível carregar as configurações mais recentes.");
        }
      });
    const sessionId = getSessionId();
    if (sessionId) void track({ data: { sessionId, eventType: "access_flow" } }).catch(() => {});
    return () => {
      alive = false;
    };
  }, [loadConfig, track]);

  const access = (settings ?? defaultSettings).access;

  return (
    <AccessShell siteName={settings?.branding.site_name}>
      <Reveal>
        <p className="text-center text-xs uppercase tracking-[0.35em] text-primary-glow">
          Liberar acesso
        </p>
        <h1 className="mt-4 text-center font-display text-3xl font-bold sm:text-4xl">
          {access.title}
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-center text-sm text-muted-foreground">
          {access.description}
        </p>
      </Reveal>

      {!settings ? (
        <div className="mt-10 flex justify-center py-16">
          <Loader2 size={28} className="animate-spin text-primary-glow" />
        </div>
      ) : (
        <>
          {error && (
            <p className="mt-6 rounded-2xl border border-border/60 p-3 text-center text-xs text-muted-foreground">
              {error}
            </p>
          )}

          <Reveal delay={120} className="mt-10">
            <AccessVideoCard access={access} />
          </Reveal>

          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            <Reveal delay={180}>
              <Link
                to="/acesso/gratis"
                className="glass glow-hover flex h-full flex-col rounded-3xl p-7 text-left transition-transform hover:-translate-y-1"
              >
                <span className="grid size-12 place-items-center rounded-2xl bg-secondary">
                  <Gift size={20} className="text-primary-glow" />
                </span>
                <h3 className="mt-5 font-display text-lg font-bold">{access.free_label}</h3>
                <p className="mt-2 flex-1 text-sm text-muted-foreground">
                  Siga o passo a passo com o nosso atendimento automático e envie o print quando
                  for solicitado.
                </p>
                <span className="mt-6 inline-flex w-full items-center justify-center rounded-2xl border border-border/60 py-3 font-display text-sm font-bold">
                  Começar agora
                </span>
              </Link>
            </Reveal>

            <Reveal delay={240}>
              <Link
                to="/acesso/pago"
                className="glass glow-hover flex h-full flex-col rounded-3xl p-7 text-left transition-transform hover:-translate-y-1"
                style={{ boxShadow: "var(--shadow-glow)" }}
              >
                <span
                  className="grid size-12 place-items-center rounded-2xl"
                  style={{ background: "var(--gradient-primary)" }}
                >
                  <Gem size={20} className="text-primary-foreground" />
                </span>
                <h3 className="mt-5 font-display text-lg font-bold">{access.paid_label}</h3>
                <p className="mt-2 flex-1 text-sm text-muted-foreground">
                  Libere tudo direto, sem etapas. Escolha um plano e finalize pelo Pix em poucos
                  segundos.
                </p>
                <span
                  className="mt-6 inline-flex w-full items-center justify-center rounded-2xl py-3 font-display text-sm font-bold text-primary-foreground"
                  style={{ background: "var(--gradient-primary)" }}
                >
                  Ver planos
                </span>
              </Link>
            </Reveal>
          </div>
        </>
      )}
    </AccessShell>
  );
}
