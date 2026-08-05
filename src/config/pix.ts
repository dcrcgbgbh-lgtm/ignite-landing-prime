// ============================================================
// CONFIGURAÇÃO PIX — edite apenas este arquivo.
// Cole aqui o seu código Pix "Copia e Cola" (payload BR Code)
// de cada plano. Deixe "" para desativar o pagamento do plano.
// ============================================================

export type PlanId = "starter" | "premium" | "vip";

export const pixConfig: Record<PlanId, { label: string; amount: string; payload: string }> = {
  starter: {
    label: "💎 Elite Starter",
    amount: "9,99",
    payload:
      "00020126580014BR.GOV.BCB.PIX013690764590-ae83-4bbc-9e58-d1821d2acaa352040000530398654049.995802BR5925Gabriel Santana Rodrigues6009SAO PAULO6214051005aHk4mCny630471B5",
  },
  premium: {
    label: "🔥 Elite Premium",
    amount: "14,90",
    payload:
      "00020126580014BR.GOV.BCB.PIX013690764590-ae83-4bbc-9e58-d1821d2acaa3520400005303986540514.995802BR5925Gabriel Santana Rodrigues6009SAO PAULO62140510C03Y58kDrp6304C466",
  },
  vip: {
    label: "👑 Elite VIP",
    amount: "29,90",
    payload:
      "00020126580014BR.GOV.BCB.PIX013690764590-ae83-4bbc-9e58-d1821d2acaa3520400005303986540529.905802BR5925Gabriel Santana Rodrigues6009SAO PAULO62140510BAM0rPKVsb63047C08",
  },
};

// Link opcional de checkout externo. Se preenchido, o botão do plano
// redireciona para essa página em vez de abrir o modal Pix.
export const checkoutUrls: Record<PlanId, string> = {
  starter: "",
  premium: "",
  vip: "",
};
