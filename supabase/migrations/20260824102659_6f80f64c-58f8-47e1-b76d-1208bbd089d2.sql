-- 1. Manual License Deliveries
CREATE TABLE IF NOT EXISTS public.manual_license_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  order_item_id uuid REFERENCES public.order_items(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  license_name text NOT NULL,
  license_key text NOT NULL,
  expiry_date date,
  platform text,
  instructions text,
  delivered_at timestamptz DEFAULT now(),
  delivered_by text,
  created_at timestamptz DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.manual_license_deliveries TO authenticated;
GRANT ALL ON public.manual_license_deliveries TO service_role;
ALTER TABLE public.manual_license_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins have full access on manual licenses"
ON public.manual_license_deliveries
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 2. Redirects
CREATE TABLE IF NOT EXISTS public.redirects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text UNIQUE NOT NULL,
  destination text NOT NULL,
  status_code integer DEFAULT 301,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.redirects TO authenticated;
GRANT ALL ON public.redirects TO service_role;
GRANT SELECT ON public.redirects TO anon;
ALTER TABLE public.redirects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins have full access on redirects"
ON public.redirects
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 3. Sync Payment Gateways
ALTER TABLE public.payment_gateways
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS type text DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS config jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0;

-- 4. Sync Payment Intents
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

-- 5. Sync Reviews
ALTER TABLE public.product_reviews
  ADD COLUMN IF NOT EXISTS display_name text;

-- 6. RPC Signature Fixes (Drop and Recreate to fix argument mismatch)
DROP FUNCTION IF EXISTS public.admin_cancel_fulfillment(uuid);
DROP FUNCTION IF EXISTS public.admin_mark_subscription_delivered(uuid);
DROP FUNCTION IF EXISTS public.admin_restart_fulfillment(uuid);
DROP FUNCTION IF EXISTS public.admin_retry_fulfillment(uuid);

CREATE OR REPLACE FUNCTION public.admin_cancel_fulfillment(_item_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Logic handled by server functions for now
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_mark_subscription_delivered(_item_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Logic handled by server functions for now
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_restart_fulfillment(_item_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Logic handled by server functions for now
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_retry_fulfillment(_item_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Logic handled by server functions for now
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_cancel_fulfillment(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_mark_subscription_delivered(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_restart_fulfillment(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_retry_fulfillment(uuid) TO authenticated;
