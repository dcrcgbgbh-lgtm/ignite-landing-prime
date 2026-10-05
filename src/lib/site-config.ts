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
  video_title: string;
  video_description: string;
  video_duration: string;
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
  ask_print: string;
  paid_pitch: string;
  fallback: string;
  error_generic: string;
  profile: string;
};
export type FaqSettings = { items: { q: string; a: string }[] };
export type SectionsSettings = Record<string, boolean>;

export type BrandingSettings = { site_name: string };
export type ChatSettings = { enabled: boolean; closed_message: string };
export type SupportSettings = {
  whatsapp_url: string; whatsapp_label: string; whatsapp_enabled: boolean;
  tiktok_url: string; tiktok_label: string; tiktok_enabled: boolean;
  instagram_url: string; instagram_label: string; instagram_enabled: boolean;
  show_in_free_access: boolean; show_in_paid_access: boolean; show_in_chat: boolean;
};

export type SiteSettings = {
  branding: BrandingSettings;
  chat: ChatSettings;
  support: SupportSettings;
  hero: HeroSettings;
  access: AccessSettings;
  free_access: FreeAccessSettings;
  bot_messages: BotMessages;
  faq: FaqSettings;
  sections: SectionsSettings;
};

export const defaultSettings: SiteSettings = {
  branding: { site_name: "FF 2022 Elite" },
  chat: {
    enabled: false,
    closed_message:
      "O chat está temporariamente fechado. Caso esteja com dificuldades em alguma etapa, converse comigo no TikTok. Se não conseguir mandar mensagem pelo TikTok, fale comigo pelo WhatsApp.",
  },
  support: {
    whatsapp_url: "", whatsapp_label: "WhatsApp", whatsapp_enabled: true,
    tiktok_url: "", tiktok_label: "TikTok", tiktok_enabled: true,
    instagram_url: "", instagram_label: "Instagram", instagram_enabled: true,
    show_in_free_access: true, show_in_paid_access: true, show_in_chat: true,
  },
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
    video_title: "Como funciona o FF 2022 Elite",
    video_description: "Assista à explicação rápida e escolha como quer liberar o seu acesso.",
    video_duration: "",
    free_label: "🎁 Acesso Grátis",
    paid_label: "💎 Acesso Pago",
  },
  free_access: {
    tiktok_url: "https://www.tiktok.com/d/4/ZS9BqmsXck5Ba-LnOQT/",
    print_hint:
      "📸 Agora mande o print aqui no chat.\n🟢 Se der certo: envie o print da tela aberta.\n🔴 Se aparecer um erro real: envie um print da mensagem de erro para identificar o problema.\n⚡ Processo rápido, organizado e sem complicação.",
  },
  bot_messages: {
    greeting_morning: "Bom dia 👋",
    greeting_afternoon: "Boa tarde 👋",
    greeting_evening: "Boa noite 👋",
    welcome:
      "Que bom ter você aqui! 👋 Vou te acompanhar durante todo o processo. É simples e leva poucos minutos. Siga cada etapa com atenção e, quando eu pedir, envie o print diretamente aqui no chat.",
    steps_title: "🚀 Acesso rápido e simples",
    steps: [],
    image_received:
      "Print recebido ✅ Vou deixar registrado aqui. Se apareceu alguma mensagem na tela, me diga também o que está escrito.",
    ask_print:
      "Me manda um print da tela que apareceu pra você 📸 Assim consigo te orientar no próximo passo.",
    paid_pitch:
      "Quer continuar sem depender das etapas do acesso grátis? Veja como funciona o acesso pago, confira o vídeo e escolha a opção que fizer sentido pra você.",
    fallback: "Estou por aqui 👋 Se travou em alguma etapa, me conta o que apareceu na tela.",
    error_generic: "Não consegui enviar sua mensagem agora. Tente novamente em instantes.",
    profile:
      "🔥 GHOST XITS | OFICIAL\n\n⚡ XITS exclusivos & atualizados\n🎯 Qualidade e suporte rápido\n📩 Atendimento pelo Direct\n👇 Chame agora e confira",
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

export const STAGE_LABELS: Record<string, string> = {
  entrou: "Entrou",
  recebeu_instrucoes: "Recebeu instruções",
  aguardando_print: "Aguardando print",
  print_recebido: "Print recebido",
  erro_relatado: "Erro relatado",
  foi_para_pago: "Foi para o pago",
  finalizada: "Finalizada",
};
