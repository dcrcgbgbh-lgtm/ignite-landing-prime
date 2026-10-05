import { useEffect, useRef, useState } from "react";
import { Check, Copy, Loader2, QrCode, X } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { getPublicConfig, recordCouponApplied } from "@/lib/public.functions";
import type { CouponConfig, PlanConfig } from "@/lib/site-config";
import {
  activeCouponsForPlan,
  discountedCents,
  formatBrl,
  parseBrlCents,
  validateCoupon,
  withPixAmount,
} from "@/lib/pix-coupon";

type CheckoutPlan = Pick<PlanConfig, "id" | "name" | "price" | "pix_payload">;

export function PlanCheckoutModal({
  plan,
  onClose,
  coupons: couponsProp,
}: {
  plan: CheckoutPlan | null;
  onClose: () => void;
  /** Lista de cupons do site. Se omitida, é carregada ao abrir. */
  coupons?: CouponConfig[];
}) {
  const [copied, setCopied] = useState(false);
  const [qrState, setQrState] = useState<"loading" | "ready" | "error">("loading");
  const [loadedCoupons, setLoadedCoupons] = useState<CouponConfig[]>([]);
  const [couponCode, setCouponCode] = useState("");
  const [applied, setApplied] = useState<CouponConfig | null>(null);
  const [couponMessage, setCouponMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const loadConfig = useServerFn(getPublicConfig);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!plan) return;
    setCopied(false);
    setQrState("loading");
    setCouponCode("");
    setApplied(null);
    setCouponMessage(null);
    let alive = true;
    const refreshCoupons = () => {
      if (couponsProp) return;
      loadConfig()
        .then((res) => {
          if (alive) setLoadedCoupons(Array.isArray(res.settings.coupons) ? res.settings.coupons : []);
        })
        .catch(() => {});
    };
    refreshCoupons();
    const couponTimer = window.setInterval(refreshCoupons, 2000);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      alive = false;
      if (couponTimer) window.clearInterval(couponTimer);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan]);

  if (!plan) return null;

  const allCoupons = couponsProp ?? loadedCoupons;
  const planCoupons = activeCouponsForPlan(allCoupons, plan.id);
  const promo = planCoupons[0];

  const basePayload = (plan.pix_payload ?? "").trim();
  const baseCents = parseBrlCents(plan.price);
  const finalCents = applied ? discountedCents(baseCents, Number(applied.discount_percent)) : baseCents;
  const discountedPayload = applied ? withPixAmount(basePayload, finalCents) : null;
  const payload = discountedPayload ?? basePayload;
  const hasKey = basePayload.length > 0;
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=0&data=${encodeURIComponent(
    payload,
  )}`;

  const applyCoupon = async () => {
    const result = validateCoupon(couponCode, plan.id, allCoupons);
    if (!result.ok) {
      setApplied(null);
      setCouponMessage({ text: result.message, ok: false });
      return;
    }
    const pct = Number(result.coupon.discount_percent);
    if (hasKey && !withPixAmount(basePayload, discountedCents(baseCents, pct))) {
      setApplied(null);
      setCouponMessage({ text: "Não foi possível aplicar o cupom a este código Pix.", ok: false });
      return;
    }
    try {
      await recordCouponApplied({
        data: {
          sessionId: getSessionId(),
          planId: plan.id,
          couponId: result.coupon.id,
          code: result.coupon.code,
          discountPercent: pct,
        },
      });
    } catch (error) {
      setApplied(null);
      setCouponMessage({
        text: error instanceof Error ? error.message : "Não foi possível aplicar este cupom.",
        ok: false,
      });
      return;
    }
    setApplied(result.coupon);
    setCouponMessage({ text: `${result.coupon.name || "Cupom"} aplicado: ${pct}% OFF.`, ok: true });
    setQrState("loading");
    setCopied(false);
  };

  const removeCoupon = () => {
    setApplied(null);
    setCouponCode("");
    setCouponMessage(null);
    setQrState("loading");
    setCopied(false);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(payload);
    } catch {
      const el = document.createElement("textarea");
      el.value = payload;
      el.setAttribute("readonly", "");
      el.style.position = "fixed";
      el.style.opacity = "0";
      document.body.appendChild(el);
      el.select();
      try {
        document.execCommand("copy");
      } catch {
        /* clipboard indisponível */
      }
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto px-5 py-8"
      role="dialog"
      aria-modal="true"
      aria-label={`Pagamento ${plan.name}`}
    >
      <button
        type="button"
        aria-label="Fechar"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/70 backdrop-blur-sm"
        style={{ animation: "fade-in 0.25s ease-out" }}
      />
      <div
        className="glass relative my-auto w-[min(460px,100%)] rounded-3xl p-7 text-center"
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
          <QrCode size={22} className="text-primary-foreground" />
        </span>

        <h3 className="mt-5 font-display text-xl font-bold">{plan.name}</h3>
        <p className="mt-1 text-sm text-muted-foreground" data-testid="checkout-price">
          Pagamento via Pix •{" "}
          <strong className="text-foreground">
            {applied ? (
              <>
                <span className="mr-2 text-muted-foreground line-through">R$ {formatBrl(baseCents)}</span>
                R$ {formatBrl(finalCents)}
              </>
            ) : (
              <>R$ {plan.price}</>
            )}
          </strong>
        </p>

        <div
          className="group relative mt-5 overflow-hidden rounded-[22px] border border-primary/25 bg-background/35 p-4 text-left"
          style={{ boxShadow: "0 16px 40px rgba(0,0,0,.18), inset 0 1px 0 rgba(255,255,255,.04)" }}
        >
          <div className="pointer-events-none absolute -right-12 -top-16 size-36 rounded-full bg-primary/10 blur-3xl" aria-hidden="true" />
          <div className="relative">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="grid size-9 place-items-center rounded-xl border border-primary/20 bg-primary/10 text-primary-glow" aria-hidden="true">🏷️</span>
                <div>
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-foreground">Cupom de desconto</p>
                  <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Economize no seu pagamento</p>
                </div>
              </div>
              {promo && (
                <span className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[10px] font-extrabold tracking-wider text-primary-glow">
                  {promo.discount_percent}% OFF
                </span>
              )}
            </div>

            {promo && !applied && (
              <div className="mt-3 rounded-xl border border-border/40 bg-black/10 px-3 py-2.5">
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  {promo.display_text || `Use o cupom ${promo.code} e receba ${promo.discount_percent}% de desconto.`}
                </p>
              </div>
            )}

            {applied ? (
              <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-primary/25 bg-primary/10 px-3.5 py-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-primary-glow">Cupom aplicado</p>
                  <p className="mt-0.5 truncate text-sm font-extrabold uppercase text-foreground">{applied.code}</p>
                </div>
                <button type="button" onClick={removeCoupon} className="shrink-0 rounded-lg border border-border/50 bg-background/40 px-3 py-2 text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground transition-all hover:border-primary/30 hover:text-foreground">
                  Remover
                </button>
              </div>
            ) : (
              <div className="mt-3 flex gap-2 rounded-xl border border-border/50 bg-black/10 p-1.5 transition-all focus-within:border-primary/40 focus-within:bg-black/20">
                <input
                  aria-label="Código do cupom"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") applyCoupon();
                  }}
                  placeholder="DIGITE SEU CUPOM"
                  className="min-w-0 flex-1 bg-transparent px-2.5 py-2 text-[11px] font-semibold uppercase tracking-wider text-foreground outline-none placeholder:text-muted-foreground/60"
                />
                <button type="button" onClick={applyCoupon} className="shrink-0 rounded-lg px-4 py-2 text-[10px] font-extrabold uppercase tracking-wider text-primary-foreground transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0" style={{ background: "var(--gradient-primary)" }}>
                  Aplicar
                </button>
              </div>
            )}

            {couponMessage && (
              <div role="status" className={`mt-2.5 flex items-center gap-2 text-[10px] font-semibold ${couponMessage.ok ? "text-primary-glow" : "text-muted-foreground"}`}>
                <span className="size-1.5 shrink-0 rounded-full bg-current" aria-hidden="true" />
                <span>{couponMessage.text}</span>
              </div>
            )}
          </div>
        </div>

        {!hasKey ? (
          <p className="mt-6 rounded-2xl border border-border/60 p-4 text-sm text-muted-foreground">
            Chave Pix ainda não configurada para este plano.
          </p>
        ) : (
          <>
            <div className="mx-auto mt-6 grid size-[220px] place-items-center rounded-2xl bg-white p-3">
              {qrState === "loading" && <Loader2 size={28} className="animate-spin text-neutral-500" />}
              {qrState === "error" ? (
                <span className="px-3 text-xs text-neutral-600">
                  Não foi possível carregar o QR Code. Use o código copia e cola abaixo.
                </span>
              ) : (
                <img
                  key={qrSrc}
                  src={qrSrc}
                  alt="QR Code Pix para pagamento"
                  width={320}
                  height={320}
                  className={`size-full object-contain ${qrState === "ready" ? "" : "hidden"}`}
                  onLoad={() => setQrState("ready")}
                  onError={() => setQrState("error")}
                />
              )}
            </div>

            <p
              data-testid="pix-payload"
              className="mt-5 break-all rounded-2xl border border-border/60 p-3 text-left text-[11px] leading-relaxed text-muted-foreground"
            >
              {payload}
            </p>

            <button
              type="button"
              onClick={copy}
              className="glow-hover mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 font-display text-sm font-bold text-primary-foreground"
              style={{ background: "var(--gradient-primary)" }}
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? "CÓDIGO COPIADO" : "COPIAR CÓDIGO PIX"}
            </button>

            <p className="mt-4 text-xs text-muted-foreground">
              Após o pagamento, envie o comprovante no suporte para liberar o acesso.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
