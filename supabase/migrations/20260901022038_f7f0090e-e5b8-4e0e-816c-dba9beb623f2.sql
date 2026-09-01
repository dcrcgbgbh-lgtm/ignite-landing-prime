-- ROLES
CREATE TYPE public.app_role AS ENUM ('owner', 'admin', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- SETTINGS
CREATE TABLE public.site_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_public boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.site_settings TO anon;
GRANT SELECT ON public.site_settings TO authenticated;
GRANT ALL ON public.site_settings TO service_role;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public reads public settings" ON public.site_settings FOR SELECT TO anon, authenticated USING (is_public = true);
CREATE POLICY "owner reads all settings" ON public.site_settings FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'owner'));
CREATE TRIGGER site_settings_updated_at BEFORE UPDATE ON public.site_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- PLANS
CREATE TABLE public.plans (
  id text PRIMARY KEY,
  name text NOT NULL,
  price text NOT NULL,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  cta text NOT NULL DEFAULT '💎 COMPRAR AGORA',
  badge text,
  highlight boolean NOT NULL DEFAULT false,
  vip boolean NOT NULL DEFAULT false,
  pix_payload text NOT NULL DEFAULT '',
  checkout_url text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.plans TO anon;
GRANT SELECT ON public.plans TO authenticated;
GRANT ALL ON public.plans TO service_role;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public reads active plans" ON public.plans FOR SELECT TO anon, authenticated USING (active = true);
CREATE POLICY "owner reads all plans" ON public.plans FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'owner'));
CREATE TRIGGER plans_updated_at BEFORE UPDATE ON public.plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.plans (id, name, price, features, cta, badge, highlight, vip, pix_payload, sort_order) VALUES
('starter', '💎 Elite Starter', '9,99', '["Download liberado","Atualizações","Suporte básico"]'::jsonb, '💎 COMPRAR AGORA', NULL, false, false, '00020126580014BR.GOV.BCB.PIX013690764590-ae83-4bbc-9e58-d1821d2acaa352040000530398654049.995802BR5925Gabriel Santana Rodrigues6009SAO PAULO6214051005aHk4mCny630471B5', 1),
('premium', '🔥 Elite Premium', '14,90', '["Tudo do Elite Starter","Prioridade no suporte","Atualizações rápidas","Melhor custo-benefício"]'::jsonb, '💎 COMPRAR AGORA', 'MAIS VENDIDO', true, false, '00020126580014BR.GOV.BCB.PIX013690764590-ae83-4bbc-9e58-d1821d2acaa3520400005303986540514.995802BR5925Gabriel Santana Rodrigues6009SAO PAULO62140510C03Y58kDrp6304C466', 2),
('vip', '👑 Elite VIP', '29,90', '["Tudo do Elite Premium","Acesso prioritário","Benefícios exclusivos","Melhor experiência"]'::jsonb, '💎 COMPRAR AGORA', 'VIP', false, true, '00020126580014BR.GOV.BCB.PIX013690764590-ae83-4bbc-9e58-d1821d2acaa3520400005303986540529.905802BR5925Gabriel Santana Rodrigues6009SAO PAULO62140510BAM0rPKVsb63047C08', 3);

INSERT INTO public.site_settings (key, value, is_public) VALUES
('hero', '{"title":"FF 2022 Elite","subtitle":"O software mais estável, atualizado e completo.","cta":"🚀 LIBERAR ACESSO"}'::jsonb, true),
('access', '{"title":"Veja como funciona","description":"Assista ao vídeo e escolha como quer liberar o seu acesso.","video_url":"","cover_url":"","video_enabled":true,"free_label":"🎁 Acesso Grátis","paid_label":"💎 Acesso Pago"}'::jsonb, true),
('free_access', '{"tiktok_url":"https://www.tiktok.com/d/4/ZS9BqmsXck5Ba-LnOQT/","print_hint":"📸 Mande o print aqui no chat."}'::jsonb, true),
('bot_messages', '{"greeting_morning":"Bom dia 👋","greeting_afternoon":"Boa tarde 👋","greeting_evening":"Boa noite 👋","welcome":"Que bom ter você aqui! 👋 Vou te acompanhar durante todo o processo. É bem simples e leva poucos minutos. Siga as etapas abaixo e, quando chegar na parte indicada, mande o print diretamente aqui no chat para eu conferir com você.","steps_title":"🚀 Acesso rápido e simples","steps":["Clique no link e faça o download.","Aguarde a instalação finalizar.","Abra o aplicativo normalmente.","Assim que conseguir entrar, envie um print aqui no chat mostrando que deu tudo certo.","Após a confirmação, o suporte orienta a próxima etapa."],"image_received":"Recebi seu print ✅ Vou conferir essa etapa com você.","fallback":"Estou por aqui 👋 Se travou em alguma etapa, me conta o que apareceu na tela.","error_generic":"Não consegui enviar sua mensagem agora. Tente novamente em instantes."}'::jsonb, true),
('faq', '{"items":[{"q":"Como funciona?","a":"Você escolhe o plano ideal, finaliza o pagamento e recebe o acesso ao download na hora, direto na tela de confirmação."},{"q":"Como recebo acesso?","a":"O acesso é liberado após a confirmação do pagamento."},{"q":"O pagamento é rápido?","a":"Sim. Pagamentos via Pix são confirmados em poucos segundos."},{"q":"Preciso instalar algo?","a":"Não é necessário nenhum programa adicional. Basta baixar o arquivo e seguir o passo a passo enviado."},{"q":"Existe suporte?","a":"Sim, nossa equipe atende todos os planos, com prioridade para Premium e VIP."}]}'::jsonb, true),
('sections', '{"reviews":true,"features":true,"faq":true,"exclusive":true}'::jsonb, true);

-- BOT RULES
CREATE TABLE public.bot_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  keywords text[] NOT NULL DEFAULT '{}',
  response text NOT NULL,
  ask_for_print boolean NOT NULL DEFAULT false,
  priority integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.bot_rules TO service_role;
GRANT SELECT ON public.bot_rules TO authenticated;
ALTER TABLE public.bot_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner reads bot rules" ON public.bot_rules FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'owner'));
CREATE TRIGGER bot_rules_updated_at BEFORE UPDATE ON public.bot_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.bot_rules (keywords, response, ask_for_print, priority) VALUES
(ARRAY['e agora','proximo','próximo','o que faço','o que fazer'], 'Agora é só seguir a etapa em que você parou. Assim que abrir o aplicativo, me manda o print aqui no chat.', true, 10),
(ARRAY['nao achei','não achei','nao encontrei','não encontrei','cade','cadê'], 'Sem problema! O link fica logo acima, no passo 1. Toque nele e o download começa.', true, 20),
(ARRAY['erro','deu erro','bugou','travou','não abre','nao abre'], 'Vamos resolver juntos. Me conta o que apareceu na tela.', true, 30),
(ARRAY['pago','plano','comprar','preço','preco'], 'Se preferir o acesso imediato, temos os planos pagos. É só tocar em "Quero ver o acesso pago".', false, 40);

-- CONVERSATIONS / MESSAGES
CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL UNIQUE,
  stage text NOT NULL DEFAULT 'entrou',
  status text NOT NULL DEFAULT 'open',
  unread_count integer NOT NULL DEFAULT 0,
  last_message text,
  last_message_at timestamptz,
  bootstrapped boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.conversations TO service_role;
GRANT SELECT ON public.conversations TO authenticated;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner reads conversations" ON public.conversations FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'owner'));
CREATE TRIGGER conversations_updated_at BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender text NOT NULL CHECK (sender IN ('user','bot','owner')),
  content text NOT NULL DEFAULT '',
  image_url text,
  auto_key text,
  read_by_owner boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.messages TO service_role;
GRANT SELECT ON public.messages TO authenticated;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner reads messages" ON public.messages FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'owner'));
CREATE INDEX messages_conversation_idx ON public.messages(conversation_id, created_at);

-- EVENTS
CREATE TABLE public.visitor_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  event_type text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, event_type)
);
GRANT ALL ON public.visitor_events TO service_role;
GRANT SELECT ON public.visitor_events TO authenticated;
ALTER TABLE public.visitor_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner reads visitor events" ON public.visitor_events FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'owner'));

CREATE TABLE public.purchase_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text,
  plan_id text,
  amount text,
  status text NOT NULL DEFAULT 'checkout_started' CHECK (status IN ('checkout_started','confirmed','cancelled')),
  confirmed_at timestamptz,
  confirmed_by uuid,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.purchase_events TO service_role;
GRANT SELECT ON public.purchase_events TO authenticated;
ALTER TABLE public.purchase_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner reads purchase events" ON public.purchase_events FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'owner'));
CREATE TRIGGER purchase_events_updated_at BEFORE UPDATE ON public.purchase_events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();