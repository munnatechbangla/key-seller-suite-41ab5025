-- 1. Infrastructure (Clean slate if needed)
CREATE TABLE IF NOT EXISTS public.orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number text NOT NULL UNIQUE,
    user_id uuid REFERENCES auth.users(id),
    email text NOT NULL,
    customer_name text,
    total numeric(12,2) NOT NULL DEFAULT 0,
    status text NOT NULL DEFAULT 'pending',
    payment_method text,
    currency text NOT NULL DEFAULT 'BDT',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  product_name text NOT NULL DEFAULT '',
  product_slug text NOT NULL DEFAULT '',
  qty integer NOT NULL DEFAULT 1,
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  variation_id uuid,
  license_pool_id_snapshot uuid,
  smm_fulfillment jsonb DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.product_variations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name text NOT NULL,
  sku text,
  price numeric(12,2) NOT NULL DEFAULT 0,
  sale_price numeric(12,2),
  compare_price numeric(12,2),
  stock integer,
  stock_status public.stock_state NOT NULL DEFAULT 'in_stock',
  status public.variation_status NOT NULL DEFAULT 'active',
  visibility text DEFAULT 'public',
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  attribute_option_ids uuid[] DEFAULT '{}'::uuid[],
  thumbnail_url text,
  delivery_type public.delivery_type,
  inventory_pool_id uuid,
  subscription_pool_id uuid,
  license_pool_id uuid,
  weight numeric(12,2),
  dimensions jsonb DEFAULT '{}'::jsonb,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.product_attributes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  display_type text DEFAULT 'select',
  sort_order int NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.product_attribute_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attribute_id uuid NOT NULL REFERENCES public.product_attributes(id) ON DELETE CASCADE,
  value text NOT NULL,
  label text NOT NULL,
  color text,
  image text,
  sort_order int NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.license_pools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.license_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id uuid NOT NULL REFERENCES public.license_pools(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  key_value text NOT NULL,
  status text NOT NULL DEFAULT 'available',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.license_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  order_item_id uuid REFERENCES public.order_items(id) ON DELETE CASCADE,
  license_key_id uuid REFERENCES public.license_keys(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

-- 2. Security
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_attributes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_attribute_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.license_pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.license_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.license_assignments ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.orders, public.order_items, public.product_variations, public.product_attributes, public.product_attribute_options, public.license_pools, public.license_keys, public.license_assignments TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders, public.order_items, public.product_variations, public.product_attributes, public.product_attribute_options, public.license_pools, public.license_keys, public.license_assignments TO authenticated;

-- RLS Policies
CREATE POLICY "Public read variants" ON public.product_variations FOR SELECT USING (true);
CREATE POLICY "Public read attributes" ON public.product_attributes FOR SELECT USING (true);
CREATE POLICY "Public read options" ON public.product_attribute_options FOR SELECT USING (true);

CREATE POLICY "Admins manage variations" ON public.product_variations FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage attributes" ON public.product_attributes FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage options" ON public.product_attribute_options FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
