// Cupons por plano + ajuste seguro do valor no payload Pix (BR Code / EMV).
import type { CouponConfig } from "@/lib/site-config";

export function parseBrlCents(value: string): number {
  const cleaned = String(value ?? "").replace(/[^\d,.]/g, "");
  const normalized = cleaned.includes(",") ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned;
  const n = Number(normalized);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

export function formatBrl(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function discountedCents(baseCents: number, percent: number): number {
  return Math.max(0, Math.round((baseCents * (100 - percent)) / 100));
}

export function crc16CcittFalse(input: string): string {
  let crc = 0xffff;
  for (let i = 0; i < input.length; i++) {
    crc ^= input.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc & 0x8000) !== 0 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

type Tlv = { id: string; value: string };

function parseTlv(payload: string): Tlv[] | null {
  const out: Tlv[] = [];
  let i = 0;
  while (i < payload.length) {
    if (i + 4 > payload.length) return null;
    const id = payload.slice(i, i + 2);
    const lenStr = payload.slice(i + 2, i + 4);
    if (!/^\d{2}$/.test(id) || !/^\d{2}$/.test(lenStr)) return null;
    const len = Number(lenStr);
    if (i + 4 + len > payload.length) return null;
    out.push({ id, value: payload.slice(i + 4, i + 4 + len) });
    i += 4 + len;
  }
  return out;
}

/** Retorna o payload com a tag 54 = valor e CRC recalculado, ou null se o payload for inválido. */
export function withPixAmount(payload: string, amountCents: number): string | null {
  const fields = parseTlv(payload.trim());
  if (!fields || fields.length === 0) return null;
  const amount = (amountCents / 100).toFixed(2);
  const rest = fields.filter((f) => f.id !== "63" && f.id !== "54");
  // Insere a tag 54 antes do primeiro campo com id maior (ex.: 58), mantendo a ordem EMV.
  const idx = rest.findIndex((f) => Number(f.id) > 54);
  const amountField: Tlv = { id: "54", value: amount };
  if (idx === -1) rest.push(amountField);
  else rest.splice(idx, 0, amountField);
  const body = rest.map((f) => f.id + String(f.value.length).padStart(2, "0") + f.value).join("") + "6304";
  return body + crc16CcittFalse(body);
}

/** Lê o valor (tag 54) de um payload Pix, em centavos. */
export function readPixAmountCents(payload: string): number | null {
  const fields = parseTlv(payload.trim());
  const f = fields?.find((x) => x.id === "54");
  return f ? Math.round(Number(f.value) * 100) : null;
}

export type CouponResult =
  | { ok: true; coupon: CouponConfig }
  | { ok: false; message: string };

export function validateCoupon(code: string, planId: string, coupons: CouponConfig[]): CouponResult {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return { ok: false, message: "Digite um código de cupom." };
  const matches = coupons.filter((c) => (c.code ?? "").trim().toUpperCase() === normalized);
  const forPlan = matches.find((c) => c.plan_id === planId);
  if (!forPlan) {
    if (matches.some((c) => c.enabled)) return { ok: false, message: "Este cupom não é válido para este plano." };
    return { ok: false, message: "Cupom inválido ou desativado." };
  }
  if (!forPlan.enabled) return { ok: false, message: "Cupom inválido ou desativado." };
  const pct = Number(forPlan.discount_percent);
  if (!Number.isFinite(pct) || pct <= 0 || pct > 100) {
    return { ok: false, message: "Este cupom não possui um desconto válido." };
  }
  const maxUses = Number(forPlan.max_uses);
  const usedCount = Number(forPlan.used_count ?? 0);
  if (Number.isFinite(maxUses) && maxUses > 0 && usedCount >= maxUses) {
    return { ok: false, message: "Este cupom já atingiu o limite de usos." };
  }
  return { ok: true, coupon: forPlan };
}

export function activeCouponsForPlan(coupons: CouponConfig[], planId: string): CouponConfig[] {
  return coupons.filter((c) => c.enabled && (c.code ?? "").trim() && c.plan_id === planId);
}
