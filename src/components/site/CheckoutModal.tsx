import { useEffect, useState } from "react";
import { Check, Copy, Loader2, QrCode, Tag, X } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { pixConfig, type PlanId } from "@/config/pix";
import { getPublicConfig } from "@/lib/public.functions";
import type { CouponConfig } from "@/lib/site-config";

function parseBrlCents(value: string): number {
  const normalized = value.replace(/\./g, "").replace(",", ".");
  return Math.round(Number(normalized) * 100);
}

function formatBrl(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function crc16CcittFalse(input: string): string {
  let crc = 0xffff;
  for (let i = 0; i < input.length; i++) {
    crc ^= input.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc & 0x8000) !== 0 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function withPixAmount(payload: string, amountCents: number): string {
  if (!payload) return payload;
  const amount = (amountCents / 100).toFixed(2);
  const crcIndex = payload.lastIndexOf("6304");
  const body = crcIndex >= 0 ? payload.slice(0, crcIndex) : payload;
  const crcPrefix = "6304";
  const tag = "54";
  const length = String(amount.length).padStart(2, "0");

  let result = "";
  let replaced = false;
  let i = 0;
  while (i + 4 <= body.length) {
    const id = body.slice(i, i + 2);
    const size = Number(body.slice(i + 2, i + 4));
    if (!Number.isFinite(size) || i + 4 + size > body.length) break;
    const value = body.slice(i + 4, i + 4 + size);
    if (id === tag) {
      result += tag + length + amount;
      replaced = true;
    } else {
      result += id + body.slice(i + 2, i + 4) + value;
    }
    i += 4 + size;
  }

  if (!replaced) {
    result = result.slice(0, -4) + tag + length + amount + result.slice(-4);
  }

  return result + crcPrefix + crc16CcittFalse(result + crcPrefix);
}

export function CheckoutModal({ planId, onClose }: { planId: PlanId | null; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const [qrState, setQrState] = useState<"loading" | "ready" | "error">("loading");
  const [coupons, setCoupons] = useState<CouponConfig[]>([]);
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<CouponConfig | null>(null);
  const [couponMessage, setCouponMessage] = useState<string | null>(null);
  const loadConfig = useServerFn(getPublicConfig);

  useEffect(() => {
    if (!planId) return;
    setCopied(false);
    setQrState("loading");
    setCouponCode("");
    setAppliedCoupon(null);
    setCouponMessage(null);
    loadConfig()
      .then((res: { settings: { coupons?: CouponConfig[] } }) => {
        setCoupons((res.settings.coupons ?? []).filter((coupon) => coupon.enabled && coupon.code.trim()));
      })
      .catch(() => setCoupons([]));
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [planId, onClose]);

  if (!planId) return null;

  const plan = pixConfig[planId];
  const baseCents = parseBrlCents(plan.amount);
  const discountedCents = appliedCoupon
    ? Math.max(0, Math.round(baseCents * (1 - appliedCoupon.discount_percent / 100)))
    : baseCents;
  const hasKey = plan.payload.trim().length > 0;
  const effectivePayload = appliedCoupon ? withPixAmount(plan.payload, discountedCents) : plan.payload;
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=0&data=${encodeURIComponent(
    effectivePayload,
  )}`;

  const applyCoupon = () => {
    const normalized = couponCode.trim().toUpperCase();
    if (!normalized) {
      setAppliedCoupon(null);
      setCouponMessage("Digite um código de cupom.");
      return;
    }
    const found = coupons.find((coupon) => coupon.code.trim().toUpperCase() === normalized);
    if (!found) {
      setAppliedCoupon(null);
      setCouponMessage("Cupom inválido ou desativado.");
      return;
    }
    if (found.discount_percent <= 0 || found.discount_percent > 100) {
      setAppliedCoupon(null);
      setCouponMessage("Este cupom não possui um desconto válido.");
      return;
    }
    setAppliedCoupon(found);
    setCouponMessage(`${found.name || "Cupom aplicado"} aplicado: ${found.discount_percent}% OFF.`);
    setQrState("loading");
    setCopied(false);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(effectivePayload);
    } catch {
      const el = document.createElement("textarea");
      el.value = effectivePayload;
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
      aria-label={`Pagamento ${plan.label}`}
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

        <h3 className="mt-5 font-display text-xl font-bold">{plan.label}</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Pagamento via Pix •{" "}
          <strong className="text-foreground">
            {appliedCoupon ? (
              <>
                <span className="mr-2 text-muted-foreground line-through">R$ {formatBrl(baseCents)}</span>
                R$ {formatBrl(discountedCents)}
              </>
            ) : (
              <>R$ {plan.amount}</>
            )}
          </strong>
        </p>

        {coupons.length > 0 && !appliedCoupon && (
          <div className="mt-5 rounded-2xl border border-primary/20 bg-primary/5 p-3 text-left">
            <div className="flex items-start gap-2">
              <Tag size={16} className="mt-0.5 shrink-0 text-primary-glow" />
              <div>
                <p className="text-xs font-bold text-foreground">🏷️ Oferta com cupom</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {coupons[0].display_text || `Use o cupom ${coupons[0].code} e receba ${coupons[0].discount_percent}% de desconto.`}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="mt-4 rounded-2xl border border-border/60 p-3">
          <label className="block text-left text-xs font-semibold text-muted-foreground">Inserir cupom</label>
          <div className="mt-2 flex gap-2">
            <input
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === "Enter") applyCoupon();
              }}
              placeholder="EX.: DESCONTO10"
              className="min-w-0 flex-1 rounded-xl border border-border/60 bg-background/60 px-3 py-2.5 text-sm uppercase outline-none focus:border-primary/60"
            />
            <button
              type="button"
              onClick={applyCoupon}
              className="rounded-xl border border-primary/40 px-3 py-2 text-xs font-bold text-primary-glow hover:bg-primary/10"
            >
              Aplicar
            </button>
          </div>
          {couponMessage && (
            <p className="mt-2 text-left text-xs text-muted-foreground">{couponMessage}</p>
          )}
        </div>

        {!hasKey ? (
          <p className="mt-6 rounded-2xl border border-border/60 p-4 text-sm text-muted-foreground">
            Chave Pix ainda não configurada. Adicione o código Pix deste plano em{" "}
            <code className="text-foreground">src/config/pix.ts</code>.
          </p>
        ) : (
          <>
            <div className="mx-auto mt-6 grid size-[220px] place-items-center rounded-2xl bg-white p-3">
              {qrState === "loading" && (
                <Loader2 size={28} className="animate-spin text-neutral-500" />
              )}
              {qrState === "error" ? (
                <span className="px-3 text-xs text-neutral-600">
                  Não foi possível carregar o QR Code. Use o código copia e cola abaixo.
                </span>
              ) : (
                <img
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

            <p className="mt-5 break-all rounded-2xl border border-border/60 p-3 text-left text-[11px] leading-relaxed text-muted-foreground">
              {effectivePayload}
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
