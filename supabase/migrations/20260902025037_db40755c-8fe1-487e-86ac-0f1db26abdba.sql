ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;
ALTER TABLE public.bot_rules ADD COLUMN IF NOT EXISTS label text NOT NULL DEFAULT '';
ALTER TABLE public.bot_rules ADD COLUMN IF NOT EXISTS delay_ms integer NOT NULL DEFAULT 600;

CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  action text NOT NULL,
  entity text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner reads audit log" ON public.audit_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'owner'::app_role));

CREATE INDEX IF NOT EXISTS audit_log_created_at_idx ON public.audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS messages_conversation_created_idx ON public.messages (conversation_id, created_at);
CREATE INDEX IF NOT EXISTS visitor_events_type_idx ON public.visitor_events (event_type);
CREATE INDEX IF NOT EXISTS purchase_events_status_idx ON public.purchase_events (status);