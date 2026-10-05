import { useEffect, useRef, useState } from "react";
import { Check, Copy, Loader2, QrCode, Tag, X } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { getPublicConfig } from "@/lib/public.functions";
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
    if (!couponsProp) {
      loadConfig()
        .then((res) => setLoadedCoupons(Array.isArray(res.settings.coupons) ? res.settings.coupons : []))
        .catch(() => setLoadedCoupons([]));
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
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

  const applyCoupon = () => {
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

        <div className="mt-5 rounded-2xl border border-primary/25 bg-primary/5 p-4 text-left">
          <p className="flex items-center gap-2 text-xs font-bold tracking-widest text-foreground">
            <Tag size={14} className="text-primary-glow" /> 🏷️ CUPOM DE DESCONTO
          </p>
          {promo && !applied && (
            <p className="mt-2 text-xs text-muted-foreground">
              {promo.display_text || `Use o cupom ${promo.code} e receba ${promo.discount_percent}% de desconto.`}
            </p>
          )}
          <div className="mt-3 flex gap-2">
            <input
              aria-label="Código do cupom"
              value={couponCode}
              disabled={!!applied}
              onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === "Enter") applyCoupon();
              }}
              placeholder="DIGITE SEU CUPOM"
              className="min-w-0 flex-1 rounded-xl border border-border/60 bg-background/60 px-3 py-2.5 text-sm uppercase outline-none focus:border-primary/60 disabled:opacity-60"
            />
            {applied ? (
              <button
                type="button"
                onClick={removeCoupon}
                className="rounded-xl border border-border/60 px-3 py-2 text-xs font-bold text-muted-foreground hover:text-foreground"
              >
                Remover
              </button>
            ) : (
              <button
                type="button"
                onClick={applyCoupon}
                className="rounded-xl border border-primary/40 px-4 py-2 text-xs font-bold text-primary-glow hover:bg-primary/10"
              >
                APLICAR
              </button>
            )}
          </div>
          {couponMessage && (
            <p
              role="status"
              className={`mt-2 text-xs ${couponMessage.ok ? "text-primary-glow" : "text-muted-foreground"}`}
            >
              {couponMessage.text}
            </p>
          )}
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
