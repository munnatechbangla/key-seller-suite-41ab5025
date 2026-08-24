-- Run consolidated bootstrap
-- Part 1: Enums
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

-- Part 2: Functions
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Part 3: Tables
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  country TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

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

CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  short_description text,
  description text,
  regular_price numeric(12,2) NOT NULL DEFAULT 0,
  sale_price numeric(12,2),
  thumbnail_url text,
  category_id uuid REFERENCES public.product_categories(id) ON DELETE SET NULL,
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

CREATE TABLE IF NOT EXISTS public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  qty integer NOT NULL DEFAULT 1,
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  smm_fulfillment jsonb DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Part 4: Permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.product_categories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_categories TO authenticated;
GRANT ALL ON public.product_categories TO service_role;
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Part 5: Helpers
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Part 6: Required Tables for build
CREATE TABLE IF NOT EXISTS public.setup_state (
    id integer PRIMARY KEY,
    is_completed boolean DEFAULT false,
    updated_at timestamptz DEFAULT now()
);
GRANT ALL ON public.setup_state TO service_role;
GRANT SELECT ON public.setup_state TO authenticated;
INSERT INTO public.setup_state (id, is_completed) VALUES (1, true) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.site_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    group_key text NOT NULL,
    setting_key text NOT NULL,
    value jsonb NOT NULL DEFAULT '{}'::jsonb,
    is_public boolean DEFAULT false,
    updated_at timestamptz DEFAULT now(),
    UNIQUE (group_key, setting_key)
);
GRANT ALL ON public.site_settings TO service_role;
GRANT SELECT ON public.site_settings TO authenticated;
GRANT SELECT ON public.site_settings TO anon;

CREATE TABLE IF NOT EXISTS public.product_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title text,
  body text,
  admin_reply text,
  is_verified boolean NOT NULL DEFAULT false,
  is_approved boolean NOT NULL DEFAULT false,
  status text DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.product_reviews TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_reviews TO authenticated;
GRANT ALL ON public.product_reviews TO service_role;
ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.list_recent_public_purchases(_limit integer)
RETURNS TABLE (id uuid, customer_name text, product_name text, emoji text, created_at timestamptz)
LANGUAGE sql STABLE AS $$
  SELECT id, 'Guest'::text, 'Product'::text, '📦'::text, created_at FROM public.order_items LIMIT _limit;
$$;
