
-- Phase 5B payment infrastructure: audit logs + intents + replay protection

CREATE TABLE IF NOT EXISTS public.payment_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  order_number text NOT NULL,
  gateway text NOT NULL,
  mode text NOT NULL DEFAULT 'sandbox',
  gateway_session_id text,
  gateway_payment_id text,
  redirect_url text,
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'initiated',
  request_payload jsonb DEFAULT '{}'::jsonb,
  response_payload jsonb DEFAULT '{}'::jsonb,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payment_intents_order ON public.payment_intents(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_intents_session ON public.payment_intents(gateway, gateway_session_id);
GRANT SELECT, INSERT, UPDATE ON public.payment_intents TO authenticated;
GRANT ALL ON public.payment_intents TO service_role;
ALTER TABLE public.payment_intents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "intents admin all" ON public.payment_intents FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "intents owner read" ON public.payment_intents FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.user_id = auth.uid()));
CREATE TRIGGER trg_payment_intents_updated BEFORE UPDATE ON public.payment_intents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.payment_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gateway text NOT NULL,
  event_type text NOT NULL,           -- init | redirect | ipn | validate | success | failed | error | replay
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  order_number text,
  payment_intent_id uuid REFERENCES public.payment_intents(id) ON DELETE SET NULL,
  transaction_id text,
  amount numeric,
  currency text,
  status text,                         -- success | failed | pending | error
  signature_valid boolean,
  ip_address text,
  user_agent text,
  request_body jsonb,
  response_body jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payment_logs_gateway ON public.payment_logs(gateway, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_logs_order ON public.payment_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_logs_tx ON public.payment_logs(transaction_id);
GRANT SELECT ON public.payment_logs TO authenticated;
GRANT ALL ON public.payment_logs TO service_role;
ALTER TABLE public.payment_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payment_logs admin read" ON public.payment_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Replay protection: unique processed webhook events per gateway
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gateway text NOT NULL,
  event_id text NOT NULL,              -- gateway-provided unique id (val_id / paymentID / evt_*)
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  processed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (gateway, event_id)
);
GRANT SELECT ON public.webhook_events TO authenticated;
GRANT ALL ON public.webhook_events TO service_role;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "webhook_events admin read" ON public.webhook_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
