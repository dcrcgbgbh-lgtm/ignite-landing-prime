import { useEffect, useState, type ReactNode } from "react";
import { useReveal, useCountUp } from "./hooks";

export function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const { ref, visible } = useReveal();
  return (
    <div
      ref={ref}
      data-visible={visible}
      className={`reveal ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

export function ScrollProgress() {
  const [p, setP] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement.scrollHeight - window.innerHeight;
      setP(h > 0 ? (window.scrollY / h) * 100 : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <div className="fixed inset-x-0 top-0 z-50 h-[3px] bg-transparent">
      <div
        className="h-full transition-[width] duration-150"
        style={{
          width: `${p}%`,
          background: "var(--gradient-primary)",
          boxShadow: "0 0 14px var(--primary-glow)",
        }}
      />
    </div>
  );
}

export function Loader() {
  const [done, setDone] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setDone(true), 1400);
    return () => clearTimeout(t);
  }, []);
  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background transition-opacity duration-700 ${
        done ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
      style={{ backgroundImage: "var(--gradient-hero)" }}
      aria-hidden={done}
    >
      <div
        className="size-14 rounded-full border-2 border-border"
        style={{
          borderTopColor: "var(--primary-glow)",
          animation: "spin-ring 900ms linear infinite",
        }}
      />
      <p className="mt-6 font-display text-xs tracking-[0.4em] text-muted-foreground">
        CARREGANDO
      </p>
    </div>
  );
}

export function BackToTop() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 600);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <button
      type="button"
      aria-label="Voltar ao topo"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className={`glow-hover fixed bottom-6 right-6 z-40 grid size-12 place-items-center rounded-full text-primary-foreground transition-all duration-500 ${
        show ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-6 opacity-0"
      }`}
      style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M12 19V5M5 12l7-7 7 7" />
      </svg>
    </button>
  );
}

export function StatCounter({
  target,
  suffix = "",
  decimals = 0,
  prefix = "",
}: {
  target: number;
  suffix?: string;
  decimals?: number;
  prefix?: string;
}) {
  const { ref, visible } = useReveal<HTMLSpanElement>();
  const v = useCountUp(target, visible);
  return (
    <span ref={ref} className="font-display text-3xl font-bold text-gradient sm:text-4xl">
      {prefix}
      {v.toLocaleString("pt-BR", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </span>
  );
}

export function OnlineCounter() {
  const [n, setN] = useState(1284);
  useEffect(() => {
    const id = setInterval(() => {
      setN((prev) => Math.max(950, prev + Math.round((Math.random() - 0.45) * 12)));
    }, 2200);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="glass inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs text-muted-foreground">
      <span className="relative flex size-2">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary-glow opacity-75" />
        <span className="relative inline-flex size-2 rounded-full bg-primary-glow" />
      </span>
      <strong className="text-foreground">{n.toLocaleString("pt-BR")}</strong> visitantes online
      agora
    </div>
  );
}
