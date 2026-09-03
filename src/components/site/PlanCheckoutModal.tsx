import { useEffect, useState } from "react";
import { Check, Copy, Loader2, QrCode, X } from "lucide-react";
import type { PlanConfig } from "@/lib/site-config";

export function PlanCheckoutModal({
  plan,
  onClose,
}: {
  plan: PlanConfig | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [qrState, setQrState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    if (!plan) return;
    setCopied(false);
    setQrState("loading");
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [plan, onClose]);

  if (!plan) return null;

  const payload = (plan.pix_payload ?? "").trim();
  const hasKey = payload.length > 0;
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=0&data=${encodeURIComponent(
    payload,
  )}`;

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
        <p className="mt-1 text-sm text-muted-foreground">
          Pagamento via Pix • <strong className="text-foreground">R$ {plan.price}</strong>
        </p>

        {!hasKey ? (
          <p className="mt-6 rounded-2xl border border-border/60 p-4 text-sm text-muted-foreground">
            Chave Pix ainda não configurada para este plano.
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
