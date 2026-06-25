
CREATE TABLE public.payment_gateways (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('builtin','custom_auto','manual')),
  logo_url text,
  description text,
  is_enabled boolean NOT NULL DEFAULT false,
  mode text NOT NULL DEFAULT 'sandbox' CHECK (mode IN ('sandbox','live')),
  sort_order int NOT NULL DEFAULT 100,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.payment_gateways TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.payment_gateways TO authenticated;
GRANT ALL ON public.payment_gateways TO service_role;

ALTER TABLE public.payment_gateways ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read enabled gateways"
  ON public.payment_gateways FOR SELECT
  USING (is_enabled = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage gateways"
  ON public.payment_gateways FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_payment_gateways_updated
  BEFORE UPDATE ON public.payment_gateways
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_payment_gateways_enabled ON public.payment_gateways (is_enabled, sort_order);
CREATE INDEX idx_payment_gateways_type ON public.payment_gateways (type);

CREATE TABLE public.manual_payment_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  payment_intent_id uuid REFERENCES public.payment_intents(id) ON DELETE SET NULL,
  gateway_id uuid REFERENCES public.payment_gateways(id) ON DELETE SET NULL,
  gateway_slug text NOT NULL,
  user_id uuid,
  email text,
  transaction_id text,
  sender_name text,
  sender_account text,
  screenshot_url text,
  amount numeric(12,2),
  currency text,
  note text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  admin_note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.manual_payment_submissions TO authenticated;
GRANT INSERT ON public.manual_payment_submissions TO anon;
GRANT ALL ON public.manual_payment_submissions TO service_role;

ALTER TABLE public.manual_payment_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their own submissions"
  ON public.manual_payment_submissions FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin')
    OR (user_id IS NOT NULL AND user_id = auth.uid())
  );

CREATE POLICY "Anyone can submit proof of payment"
  ON public.manual_payment_submissions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins update submissions"
  ON public.manual_payment_submissions FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_manual_submissions_updated
  BEFORE UPDATE ON public.manual_payment_submissions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_manual_subs_order ON public.manual_payment_submissions (order_id);
CREATE INDEX idx_manual_subs_status ON public.manual_payment_submissions (status, created_at DESC);

INSERT INTO public.payment_gateways (slug, name, type, description, is_enabled, mode, sort_order, config) VALUES
  ('sslcommerz','SSLCommerz','builtin','Bangladesh hosted checkout (cards, mobile banking, internet banking).', false, 'sandbox', 10, '{"requires_secrets":["SSLCOMMERZ_STORE_ID","SSLCOMMERZ_STORE_PASSWORD"]}'::jsonb),
  ('bkash','bKash','builtin','bKash Tokenized Checkout.', false, 'sandbox', 20, '{"requires_secrets":["BKASH_APP_KEY","BKASH_APP_SECRET","BKASH_USERNAME","BKASH_PASSWORD"]}'::jsonb),
  ('nagad','Nagad','builtin','Nagad payment gateway.', false, 'sandbox', 30, '{"requires_secrets":["NAGAD_MERCHANT_ID","NAGAD_PRIVATE_KEY","NAGAD_PUBLIC_KEY"]}'::jsonb),
  ('rocket','Rocket','builtin','Rocket / DBBL Mobile Banking.', false, 'sandbox', 40, '{}'::jsonb),
  ('stripe','Stripe','builtin','International cards via Stripe Checkout.', false, 'sandbox', 50, '{"requires_secrets":["STRIPE_SECRET_KEY","STRIPE_WEBHOOK_SECRET"]}'::jsonb),
  ('paypal','PayPal','builtin','PayPal Express Checkout.', false, 'sandbox', 60, '{"requires_secrets":["PAYPAL_CLIENT_ID","PAYPAL_CLIENT_SECRET"]}'::jsonb)
ON CONFLICT (slug) DO NOTHING;
