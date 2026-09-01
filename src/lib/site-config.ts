// Tipos e valores padrão (fallback) da configuração do site.
// A fonte real é a tabela site_settings / plans no banco.

export type PlanConfig = {
  id: string;
  name: string;
  price: string;
  features: string[];
  cta: string;
  badge: string | null;
  highlight: boolean;
  vip: boolean;
  pix_payload: string;
  checkout_url: string;
  active: boolean;
  sort_order: number;
};

export type HeroSettings = { title: string; subtitle: string; cta: string };
export type AccessSettings = {
  title: string;
  description: string;
  video_url: string;
  cover_url: string;
  video_enabled: boolean;
  free_label: string;
  paid_label: string;
};
export type FreeAccessSettings = { tiktok_url: string; print_hint: string };
export type BotMessages = {
  greeting_morning: string;
  greeting_afternoon: string;
  greeting_evening: string;
  welcome: string;
  steps_title: string;
  steps: string[];
  image_received: string;
  fallback: string;
  error_generic: string;
};
export type FaqSettings = { items: { q: string; a: string }[] };
export type SectionsSettings = Record<string, boolean>;

export type SiteSettings = {
  hero: HeroSettings;
  access: AccessSettings;
  free_access: FreeAccessSettings;
  bot_messages: BotMessages;
  faq: FaqSettings;
  sections: SectionsSettings;
};

export const defaultSettings: SiteSettings = {
  hero: {
    title: "FF 2022 Elite",
    subtitle: "O software mais estável, atualizado e completo.",
    cta: "🚀 LIBERAR ACESSO",
  },
  access: {
    title: "Veja como funciona",
    description: "Assista ao vídeo e escolha como quer liberar o seu acesso.",
    video_url: "",
    cover_url: "",
    video_enabled: true,
    free_label: "🎁 Acesso Grátis",
    paid_label: "💎 Acesso Pago",
  },
  free_access: {
    tiktok_url: "https://www.tiktok.com/d/4/ZS9BqmsXck5Ba-LnOQT/",
    print_hint: "📸 Mande o print aqui no chat.",
  },
  bot_messages: {
    greeting_morning: "Bom dia 👋",
    greeting_afternoon: "Boa tarde 👋",
    greeting_evening: "Boa noite 👋",
    welcome:
      "Que bom ter você aqui! 👋 Vou te acompanhar durante todo o processo. É bem simples e leva poucos minutos.",
    steps_title: "🚀 Acesso rápido e simples",
    steps: [],
    image_received: "Recebi seu print ✅ Vou conferir essa etapa com você.",
    fallback: "Estou por aqui 👋 Se travou em alguma etapa, me conta o que apareceu na tela.",
    error_generic: "Não consegui enviar sua mensagem agora. Tente novamente em instantes.",
  },
  faq: { items: [] },
  sections: { reviews: true, features: true, faq: true, exclusive: true },
};

export function mergeSettings(raw: Record<string, unknown> | undefined | null): SiteSettings {
  const out = { ...defaultSettings } as SiteSettings;
  if (!raw) return out;
  for (const key of Object.keys(defaultSettings) as (keyof SiteSettings)[]) {
    const value = raw[key];
    if (value && typeof value === "object") {
      out[key] = { ...(defaultSettings[key] as object), ...(value as object) } as never;
    }
  }
  return out;
}

export type ChatMessage = {
  id: string;
  sender: "user" | "bot" | "owner";
  content: string;
  image_url: string | null;
  created_at: string;
};
