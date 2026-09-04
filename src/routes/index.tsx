import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Zap,
  ShieldCheck,
  Gem,
  Wrench,
  Globe2,
  Heart,
  Star,
  Crown,
  Flame,
  Check,
  ChevronDown,
  Instagram,
  Youtube,
  Twitter,
  MessageCircle,
  Lock,
  Play,
  X,
  Rocket,
} from "lucide-react";
import heroImg from "@/assets/hero.jpg";
import { CheckoutModal } from "@/components/site/CheckoutModal";
import { checkoutUrls, type PlanId } from "@/config/pix";
import { Particles } from "@/components/site/Particles";
import {
  Reveal,
  ScrollProgress,
  Loader,
  BackToTop,
  StatCounter,
  OnlineCounter,
} from "@/components/site/ui";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FF 2022 Elite | Software Estável, Atualizado e Completo" },
      {
        name: "description",
        content:
          "FF 2022 Elite: o software mais estável, atualizado e completo. Acesso imediato, servidores rápidos e conteúdo exclusivo. Planos a partir de R$ 9,99.",
      },
      { property: "og:title", content: "FF 2022 Elite" },
      {
        property: "og:description",
        content:
          "O software mais estável, atualizado e completo. Planos Elite Starter, Elite Premium e Elite VIP.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const plans = [
  {
    id: "starter" as PlanId,
    name: "💎 Elite Starter",
    price: "9,99",
    features: ["Download liberado", "Atualizações", "Suporte básico"],
    cta: "💎 COMPRAR AGORA",
    badge: null as string | null,
    highlight: false,
    vip: false,
  },
  {
    id: "premium" as PlanId,
    name: "🔥 Elite Premium",
    price: "14,90",
    features: [
      "Tudo do Elite Starter",
      "Prioridade no suporte",
      "Atualizações rápidas",
      "Melhor custo-benefício",
    ],
    cta: "💎 COMPRAR AGORA",
    badge: "MAIS VENDIDO",
    highlight: true,
    vip: false,
  },
  {
    id: "vip" as PlanId,
    name: "👑 Elite VIP",
    price: "29,90",
    features: [
      "Tudo do Elite Premium",
      "Acesso prioritário",
      "Benefícios exclusivos",
      "Melhor experiência",
    ],
    cta: "💎 COMPRAR AGORA",
    badge: "VIP",
    highlight: false,
    vip: true,
  },
];

const exclusiveVideos = [
  { title: "Configuração Elite completa", duration: "12:40", tint: "26.5" },
  { title: "Ajustes avançados de estabilidade", duration: "08:15", tint: "14" },
  { title: "Otimização para celulares", duration: "10:02", tint: "40" },
  { title: "Atualizações e manutenção", duration: "06:33", tint: "5" },
  { title: "Suporte VIP: passo a passo", duration: "15:21", tint: "32" },
  { title: "Recursos exclusivos Elite", duration: "09:47", tint: "20" },
];


const reviews = [
  { text: "Funcionou perfeitamente.", author: "Lucas M." },
  { text: "Muito rápido e fácil.", author: "Bianca R." },
  { text: "Visual incrível e excelente experiência.", author: "Diego S." },
];

const features = [
  { icon: Zap, title: "Velocidade", desc: "Servidores otimizados para download em segundos." },
  { icon: ShieldCheck, title: "Segurança", desc: "Arquivos verificados e conexão criptografada." },
  { icon: Gem, title: "Qualidade", desc: "Versões íntegras, testadas e sem alterações." },
  { icon: Wrench, title: "Atualizações Frequentes", desc: "Novas versões liberadas continuamente." },
  { icon: Globe2, title: "Multi-dispositivos", desc: "Compatível com celulares, tablets e PC." },
  { icon: Heart, title: "Suporte ao Cliente", desc: "Atendimento humano sempre que precisar." },
];

const faqs = [
  {
    q: "Como funciona?",
    a: "Você escolhe o plano ideal, finaliza o pagamento e recebe o acesso ao download na hora, direto na tela de confirmação.",
  },
  {
    q: "Como recebo acesso?",
    a: "O acesso é liberado automaticamente após a confirmação do pagamento e também enviado para o seu e-mail.",
  },
  {
    q: "O pagamento é rápido?",
    a: "Sim. Pagamentos via Pix e cartão são confirmados em poucos segundos.",
  },
  {
    q: "Preciso instalar algo?",
    a: "Não é necessário nenhum programa adicional. Basta baixar o arquivo e seguir o passo a passo enviado.",
  },
  {
    q: "Existe suporte?",
    a: "Sim, nossa equipe atende todos os planos, com prioridade para Premium e Ultimate VIP.",
  },
];

function Stars() {
  return (
    <div className="flex gap-1 text-primary-glow">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} size={16} fill="currentColor" strokeWidth={0} />
      ))}
    </div>
  );
}

function LockedVideoModal({
  video,
  onClose,
}: {
  video: (typeof exclusiveVideos)[number] | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!video) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [video, onClose]);

  if (!video) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center px-5"
      role="dialog"
      aria-modal="true"
      aria-label="Conteúdo exclusivo"
    >
      <button
        type="button"
        aria-label="Fechar"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/70 backdrop-blur-sm"
        style={{ animation: "fade-in 0.25s ease-out" }}
      />
      <div
        className="glass relative w-[min(460px,100%)] rounded-3xl p-8 text-center"
        style={{
          boxShadow: "var(--shadow-glow), var(--shadow-elegant)",
          animation: "scale-in 0.28s cubic-bezier(0.16,1,0.3,1)",
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="absolute right-4 top-4 grid size-9 place-items-center rounded-xl text-muted-foreground transition-colors hover:text-foreground"
        >
          <X size={18} />
        </button>
        <span
          className="mx-auto grid size-14 place-items-center rounded-2xl"
          style={{ background: "var(--gradient-primary)" }}
        >
          <Lock size={22} className="text-primary-foreground" />
        </span>
        <h3 className="mt-5 font-display text-xl font-bold">Conteúdo exclusivo</h3>
        <p className="mt-3 text-sm text-muted-foreground">
          “{video.title}” está disponível apenas para assinantes. Escolha um plano para liberar
          todo o conteúdo Elite.
        </p>
        <Link
          to="/acesso"
          onClick={onClose}
          className="glow-hover mt-7 inline-flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 font-display text-sm font-bold text-primary-foreground"
          style={{ background: "var(--gradient-primary)" }}
        >
          <Gem size={16} />
          Ver Planos
        </Link>
      </div>
    </div>
  );
}

function Index() {
  const [open, setOpen] = useState<number | null>(0);
  const [lockedVideo, setLockedVideo] = useState<(typeof exclusiveVideos)[number] | null>(null);
  const [checkoutPlan, setCheckoutPlan] = useState<PlanId | null>(null);

  const startCheckout = (id: PlanId) => {
    const url = checkoutUrls[id];
    if (url) {
      window.location.href = url;
      return;
    }
    setCheckoutPlan(id);
  };


  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background">
      <Loader />
      <ScrollProgress />
      <Particles />
      <BackToTop />

      <header className="fixed inset-x-0 top-0 z-40 mx-auto mt-4 flex w-[min(1180px,92vw)] items-center justify-between rounded-2xl px-4 py-3 glass">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="grid size-8 shrink-0 place-items-center rounded-lg"
            style={{ background: "var(--gradient-primary)" }}
          >
            <Flame size={16} className="text-primary-foreground" />
          </span>
          <span className="truncate font-display text-sm font-bold">FF 2022 Elite</span>
        </div>
        <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
          <a href="#avaliacoes" className="transition-colors hover:text-foreground">
            Avaliações
          </a>
          <a href="#diferenciais" className="transition-colors hover:text-foreground">
            Diferenciais
          </a>
          <a href="#faq" className="transition-colors hover:text-foreground">
            FAQ
          </a>
        </nav>
        <Link
          to="/acesso"
          className="glow-hover inline-flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold text-primary-foreground"
          style={{ background: "var(--gradient-primary)" }}
        >
          🚀 LIBERAR ACESSO
        </Link>

      </header>

      {/* HERO */}
      <section className="relative isolate flex min-h-[100svh] items-center justify-center px-5 pb-20 pt-32">
        <img
          src={heroImg}
          alt="Ambiente escuro com luzes vermelhas representando o download premium"
          width={1920}
          height={1088}
          className="absolute inset-0 -z-10 size-full object-cover opacity-95"
        />
        <div
          className="absolute inset-0 -z-10"
          style={{
            background:
              "linear-gradient(180deg, oklch(0.145 0 0 / 0.35) 30%, oklch(0.145 0 0 / 0.9) 100%), var(--gradient-hero)",
          }}
        />

        <div className="mx-auto w-[min(1100px,100%)] text-center">
          <Reveal>
            <OnlineCounter />
          </Reveal>
          <Reveal delay={100}>
            <h1 className="mt-6 font-display text-4xl font-extrabold leading-[1.05] sm:text-6xl lg:text-7xl">
              <span className="text-gradient">FF 2022</span>{" "}
              <span className="text-foreground">Elite</span>
            </h1>
          </Reveal>
          <Reveal delay={200}>
            <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
              O software mais estável, atualizado e completo.
            </p>
          </Reveal>
          <Reveal delay={300}>
            <div className="mt-9 flex justify-center">
              <Link
                to="/acesso"
                className="glow-hover group relative inline-flex items-center gap-3 overflow-hidden rounded-2xl px-9 py-4 font-display text-sm font-bold tracking-wide text-primary-foreground sm:text-base"
                style={{
                  background: "var(--gradient-primary)",
                  animation: "pulse-glow 3s ease-in-out infinite",
                }}
              >
                <Rocket size={18} />
                🚀 LIBERAR ACESSO

                <span
                  className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 skew-x-12 bg-white/25"
                  style={{ animation: "shimmer 2.8s ease-in-out infinite" }}
                />
              </Link>
            </div>
          </Reveal>

          <div className="mx-auto mt-16 grid w-full grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              { label: "Downloads", node: <StatCounter target={100000} prefix="+" /> },
              { label: "Avaliações", node: <StatCounter target={4.9} decimals={1} suffix="/5" /> },
              { label: "Servidores Rápidos", node: <StatCounter target={99.9} decimals={1} suffix="%" /> },
              { label: "Download Seguro", node: <StatCounter target={100} suffix="%" /> },
            ].map((s, i) => (
              <Reveal key={s.label} delay={i * 90}>
                <div className="glass glow-hover rounded-2xl px-4 py-6">
                  {s.node}
                  <p className="mt-2 text-xs uppercase tracking-widest text-muted-foreground">
                    {s.label}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* AVALIAÇÕES */}
      <section id="avaliacoes" className="relative z-10 px-5 py-24">
        <div className="mx-auto w-[min(1180px,100%)]">
          <Reveal>
            <p className="text-center text-xs uppercase tracking-[0.35em] text-primary-glow">
              Avaliações
            </p>
            <h2 className="mt-4 text-center font-display text-3xl font-bold sm:text-5xl">
              Quem baixou, aprovou
            </h2>
          </Reveal>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {reviews.map((r, i) => (
              <Reveal key={r.author} delay={i * 130}>
                <figure className="glass glow-hover h-full rounded-3xl p-7">
                  <Stars />
                  <blockquote className="mt-5 font-display text-lg leading-snug">
                    “{r.text}”
                  </blockquote>
                  <figcaption className="mt-6 text-xs uppercase tracking-widest text-muted-foreground">
                    {r.author} · Compra verificada
                  </figcaption>
                </figure>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* CONTEÚDO EXCLUSIVO */}
      <section id="conteudo-exclusivo" className="relative z-10 px-5 py-24">
        <div className="mx-auto w-[min(1180px,100%)]">
          <Reveal>
            <p className="text-center text-xs uppercase tracking-[0.35em] text-primary-glow">
              Conteúdo Exclusivo
            </p>
            <h2 className="mt-4 text-center font-display text-3xl font-bold sm:text-5xl">
              Vídeos liberados para assinantes
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-center text-sm text-muted-foreground">
              Todo o acervo fica visível, mas o acesso é liberado somente após a confirmação do
              pagamento.
            </p>
          </Reveal>

          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {exclusiveVideos.map((video, i) => (
              <Reveal key={video.title} delay={i * 90}>
                <button
                  type="button"
                  onClick={() => setLockedVideo(video)}
                  aria-label={`Conteúdo bloqueado: ${video.title}`}
                  className="glass glow-hover group block w-full overflow-hidden rounded-3xl p-3 text-left"
                >
                  <div className="relative aspect-video overflow-hidden rounded-2xl">
                    <div
                      className="absolute inset-0 transition-transform duration-500 group-hover:scale-105"
                      style={{
                        background: `radial-gradient(120% 100% at 30% 0%, oklch(0.45 0.18 ${video.tint} / 0.75) 0%, oklch(0.16 0.02 ${video.tint}) 70%)`,
                      }}
                    />
                    <div className="absolute inset-0 backdrop-blur-[3px]" />
                    <div className="absolute inset-0 grid place-items-center">
                      <span
                        className="grid size-14 place-items-center rounded-2xl border border-white/10"
                        style={{ background: "oklch(0.145 0 0 / 0.55)" }}
                      >
                        <Lock size={20} className="text-primary-glow" />
                      </span>
                    </div>
                    <span className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-bold tracking-widest text-white/80">
                      <Play size={10} fill="currentColor" strokeWidth={0} />
                      {video.duration}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-3 px-3 py-4">
                    <h3 className="min-w-0 font-display text-sm font-bold">{video.title}</h3>
                    <span className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-[10px] font-bold tracking-widest text-muted-foreground">
                      BLOQUEADO
                    </span>
                  </div>
                </button>
              </Reveal>
            ))}
          </div>
        </div>
      </section>



      {/* DIFERENCIAIS */}
      <section id="diferenciais" className="relative z-10 px-5 py-24">
        <div className="mx-auto w-[min(1180px,100%)]">
          <Reveal>
            <p className="text-center text-xs uppercase tracking-[0.35em] text-primary-glow">
              Diferenciais
            </p>
            <h2 className="mt-4 text-center font-display text-3xl font-bold sm:text-5xl">
              Feito para quem exige o melhor
            </h2>
          </Reveal>
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => (
              <Reveal key={f.title} delay={i * 90}>
                <div className="glass glow-hover h-full rounded-3xl p-7">
                  <span
                    className="grid size-11 place-items-center rounded-2xl"
                    style={{ background: "oklch(0.51 0.2 26.5 / 0.18)" }}
                  >
                    <f.icon size={20} className="text-primary-glow" />
                  </span>
                  <h3 className="mt-5 font-display text-lg font-bold">{f.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="relative z-10 px-5 py-24">
        <div className="mx-auto w-[min(820px,100%)]">
          <Reveal>
            <p className="text-center text-xs uppercase tracking-[0.35em] text-primary-glow">
              FAQ
            </p>
            <h2 className="mt-4 text-center font-display text-3xl font-bold sm:text-5xl">
              Perguntas frequentes
            </h2>
          </Reveal>
          <div className="mt-12 space-y-3">
            {faqs.map((item, i) => {
              const isOpen = open === i;
              return (
                <Reveal key={item.q} delay={i * 70}>
                  <div className="glass overflow-hidden rounded-2xl">
                    <button
                      type="button"
                      onClick={() => setOpen(isOpen ? null : i)}
                      aria-expanded={isOpen}
                      className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
                    >
                      <span className="min-w-0 font-display text-base font-semibold">
                        {item.q}
                      </span>
                      <ChevronDown
                        size={18}
                        className={`shrink-0 text-primary-glow transition-transform duration-300 ${
                          isOpen ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                    <div
                      className="grid transition-all duration-500 ease-out"
                      style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
                    >
                      <div className="overflow-hidden">
                        <p className="px-6 pb-5 text-sm text-muted-foreground">{item.a}</p>
                      </div>
                    </div>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="relative z-10 px-5 pb-24">
        <Reveal>
          <div
            className="glass mx-auto w-[min(1180px,100%)] rounded-[2rem] px-8 py-16 text-center"
            style={{ backgroundImage: "var(--gradient-hero)" }}
          >
            <h2 className="font-display text-3xl font-bold sm:text-4xl">
              Pronto para liberar seu acesso?
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-sm text-muted-foreground">
              Acesso imediato após a confirmação. Sem espera, sem complicação.
            </p>
            <Link
              to="/acesso"
              className="glow-hover mt-8 inline-flex items-center gap-3 rounded-2xl px-9 py-4 font-display text-sm font-bold text-primary-foreground"
              style={{ background: "var(--gradient-primary)" }}
            >
              <Rocket size={18} />
              🚀 LIBERAR ACESSO
            </Link>

          </div>
        </Reveal>
      </section>

      {/* FOOTER */}
      <footer className="relative z-10 border-t border-border px-5 py-14">
        <div className="mx-auto grid w-[min(1180px,100%)] gap-8 md:grid-cols-[1fr_auto] md:items-center">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span
                className="grid size-8 shrink-0 place-items-center rounded-lg"
                style={{ background: "var(--gradient-primary)" }}
              >
                <Flame size={16} className="text-primary-foreground" />
              </span>
              <span className="font-display text-sm font-bold">FF 2022 Elite</span>
            </div>
            <p className="mt-4 max-w-md text-xs text-muted-foreground">
              © 2026 Todos os direitos reservados. Este site não possui vínculo oficial com
              desenvolvedores ou distribuidoras de jogos.
            </p>
            <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
              <a href="#faq" className="transition-colors hover:text-foreground">
                Política de Privacidade
              </a>
              <a href="#faq" className="transition-colors hover:text-foreground">
                Termos de Uso
              </a>
            </div>
          </div>
          <div className="flex gap-3">
            {[Instagram, Youtube, Twitter, MessageCircle].map((Icon, i) => (
              <a
                key={i}
                href="#"
                aria-label="Rede social"
                className="glass glow-hover grid size-11 place-items-center rounded-xl text-muted-foreground transition-colors hover:text-foreground"
              >
                <Icon size={18} />
              </a>
            ))}
          </div>
        </div>
      </footer>

      <LockedVideoModal video={lockedVideo} onClose={() => setLockedVideo(null)} />
      <CheckoutModal planId={checkoutPlan} onClose={() => setCheckoutPlan(null)} />
    </div>

  );
}
