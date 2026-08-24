-- 1. Core Enums and Types
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'customer', 'affiliate', 'support');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.product_status AS ENUM ('draft', 'published', 'private', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.stock_state AS ENUM ('in_stock', 'out_of_stock', 'on_backorder');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.product_type AS ENUM ('downloadable', 'license_key', 'subscription', 'account', 'external', 'manual', 'smm_service');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.delivery_type AS ENUM ('download', 'license_key', 'account', 'manual', 'external_url', 'smm_fulfillment');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.product_visibility AS ENUM ('public', 'members_only', 'hidden');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.variation_status AS ENUM ('active', 'inactive');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE public.smm_order_status AS ENUM ('pending', 'processing', 'partial', 'completed', 'cancelled', 'refunded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Products table with all columns
CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  short_description text,
  description text,
  regular_price numeric(12,2) NOT NULL DEFAULT 0,
  sale_price numeric(12,2),
  thumbnail_url text,
  category_id uuid, -- Foreign key added later
  sku text,
  stock_status public.stock_state NOT NULL DEFAULT 'in_stock',
  status public.product_status NOT NULL DEFAULT 'draft',
  is_featured boolean NOT NULL DEFAULT false,
  is_digital boolean NOT NULL DEFAULT true,
  is_license_key boolean NOT NULL DEFAULT false,
  is_subscription boolean NOT NULL DEFAULT false,
  is_external boolean NOT NULL DEFAULT false,
  external_url text,
  product_type public.product_type,
  delivery_type public.delivery_type,
  visibility public.product_visibility NOT NULL DEFAULT 'public',
  smm_config JSONB DEFAULT NULL,
  sales_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Orders and Items
CREATE TABLE IF NOT EXISTS public.orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number text NOT NULL UNIQUE,
    user_id uuid REFERENCES auth.users(id),
    email text NOT NULL,
    total numeric(12,2) NOT NULL DEFAULT 0,
    status text NOT NULL DEFAULT 'pending',
    payment_method text,
    currency text NOT NULL DEFAULT 'BDT',
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  product_name text NOT NULL DEFAULT '',
  product_slug text NOT NULL DEFAULT '',
  qty integer NOT NULL DEFAULT 1,
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  smm_fulfillment jsonb DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Categories
CREATE TABLE IF NOT EXISTS public.product_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid REFERENCES public.product_categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  icon text,
  image_url text,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.products ADD CONSTRAINT products_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.product_categories(id) ON DELETE SET NULL;

-- 5. Variations and Attributes
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

CREATE TABLE IF NOT EXISTS public.product_variations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name text NOT NULL,
  sku text,
  price numeric(12,2) NOT NULL DEFAULT 0,
  sale_price numeric(12,2),
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

-- 6. License Management
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

-- 7. Gallery and Downloads
CREATE TABLE IF NOT EXISTS public.product_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  url text NOT NULL,
  alt text,
  sort_order int NOT NULL DEFAULT 0,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.product_downloads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_url text NOT NULL,
  version text,
  file_size bigint,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 8. Gateways and Emails
CREATE TABLE IF NOT EXISTS public.payment_gateways (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug text NOT NULL UNIQUE,
    is_enabled boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.email_templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    template_key text NOT NULL UNIQUE,
    subject text,
    html_body text,
    enabled boolean DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.email_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    template_key text,
    recipient text NOT NULL,
    subject text,
    status text,
    rendered_html text,
    payload jsonb,
    attempts integer DEFAULT 0,
    error_message text,
    provider text,
    sent_at timestamptz,
    created_at timestamptz DEFAULT now()
);

-- 9. Other dependencies
CREATE TABLE IF NOT EXISTS public.legal_pages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug text NOT NULL UNIQUE,
    title text NOT NULL,
    content text,
    is_active boolean DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.coupon_usage (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public.coupons (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public.downloads (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public.manual_payment_submissions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public.payments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public.payment_intents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

-- 10. GRANTS
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON public.products, public.product_categories, public.product_images, public.product_variations, public.product_attributes, public.product_attribute_options, public.product_reviews, public.site_settings TO anon;

-- 11. RLS
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;

-- 12. Dummy Policies (Avoid recursion)
CREATE POLICY "Public read products" ON public.products FOR SELECT USING (true);
CREATE POLICY "Public read categories" ON public.product_categories FOR SELECT USING (true);
CREATE POLICY "Public read variants" ON public.product_variations FOR SELECT USING (true);
