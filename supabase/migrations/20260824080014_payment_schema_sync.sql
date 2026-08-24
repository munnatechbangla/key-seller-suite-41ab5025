-- 1. Extend Payment Gateways
ALTER TABLE public.payment_gateways
  ADD COLUMN IF NOT EXISTS type text DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS config jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS name text;

-- 2. Extend Payment Intents
ALTER TABLE public.payment_intents
  ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES public.orders(id),
  ADD COLUMN IF NOT EXISTS order_number text,
  ADD COLUMN IF NOT EXISTS gateway text,
  ADD COLUMN IF NOT EXISTS mode text,
  ADD COLUMN IF NOT EXISTS amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS currency text,
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS gateway_session_id text,
  ADD COLUMN IF NOT EXISTS redirect_url text,
  ADD COLUMN IF NOT EXISTS response_payload jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- 3. Extend Manual License Deliveries
ALTER TABLE public.manual_license_deliveries
  ADD COLUMN IF NOT EXISTS order_item_id uuid REFERENCES public.order_items(id),
  ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.products(id),
  ADD COLUMN IF NOT EXISTS license_name text,
  ADD COLUMN IF NOT EXISTS license_key text,
  ADD COLUMN IF NOT EXISTS expiry_date date,
  ADD COLUMN IF NOT EXISTS platform text,
  ADD COLUMN IF NOT EXISTS instructions text,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS delivered_by text;

-- 4. Extend Product Reviews for public display
ALTER TABLE public.product_reviews
  ADD COLUMN IF NOT EXISTS display_name text;

-- 5. Fix search_path for all RPCs
ALTER FUNCTION public.admin_cancel_fulfillment(uuid) SET search_path = public;
ALTER FUNCTION public.admin_mark_subscription_delivered(uuid) SET search_path = public;
ALTER FUNCTION public.admin_restart_fulfillment(uuid) SET search_path = public;
ALTER FUNCTION public.admin_retry_fulfillment(uuid) SET search_path = public;
ALTER FUNCTION public.get_fulfillment_timeline(uuid, text) SET search_path = public;
ALTER FUNCTION public.get_order_fulfillments(uuid, text) SET search_path = public;
