-- Part 1: Landing Pages
CREATE TABLE IF NOT EXISTS public.landing_pages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug text NOT NULL UNIQUE,
    title text NOT NULL,
    content jsonb DEFAULT '[]'::jsonb,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Part 2: Fulfillment & Inventory RPCs
CREATE OR REPLACE FUNCTION public.get_order_fulfillments(_order_id uuid)
RETURNS jsonb LANGUAGE plpgsql AS $$
BEGIN
  RETURN '[]'::jsonb;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_fulfillment_timeline(_order_id uuid)
RETURNS jsonb LANGUAGE plpgsql AS $$
BEGIN
  RETURN '[]'::jsonb;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_retry_fulfillment(_item_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  RETURN;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_restart_fulfillment(_item_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  RETURN;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_cancel_fulfillment(_item_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  RETURN;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_mark_subscription_delivered(_item_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  RETURN;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_inventory_pools()
RETURNS jsonb LANGUAGE plpgsql AS $$
BEGIN
  RETURN '[]'::jsonb;
END;
$$;

-- Part 3: GRANTS
GRANT ALL ON public.landing_pages TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.landing_pages TO authenticated;
GRANT SELECT ON public.landing_pages TO anon;
