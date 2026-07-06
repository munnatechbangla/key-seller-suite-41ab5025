
-- === Product Management 2.0 Foundation ===

-- 1) Enums (idempotent)
DO $$ BEGIN
  CREATE TYPE public.product_type AS ENUM (
    'downloadable','license_key','subscription','account','external','manual'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.delivery_type AS ENUM (
    'download','license_key','account','manual','external_url'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.product_visibility AS ENUM ('public','members_only','hidden');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.variation_status AS ENUM ('active','inactive');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Add 'private' to product_status if missing
DO $$ BEGIN
  ALTER TYPE public.product_status ADD VALUE IF NOT EXISTS 'private';
EXCEPTION WHEN others THEN NULL; END $$;

-- 2) Extend products (all nullable/defaulted for backward compatibility)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS product_type public.product_type,
  ADD COLUMN IF NOT EXISTS delivery_type public.delivery_type,
  ADD COLUMN IF NOT EXISTS visibility public.product_visibility NOT NULL DEFAULT 'public';

-- Backfill product_type/delivery_type from legacy flags where NULL
UPDATE public.products SET product_type = CASE
    WHEN is_license_key THEN 'license_key'::public.product_type
    WHEN is_subscription THEN 'subscription'::public.product_type
    WHEN is_external THEN 'external'::public.product_type
    ELSE 'downloadable'::public.product_type
  END
  WHERE product_type IS NULL;

UPDATE public.products SET delivery_type = CASE
    WHEN is_license_key THEN 'license_key'::public.delivery_type
    WHEN is_external THEN 'external_url'::public.delivery_type
    ELSE 'download'::public.delivery_type
  END
  WHERE delivery_type IS NULL;

-- 3) Extend product_variations
ALTER TABLE public.product_variations
  ADD COLUMN IF NOT EXISTS compare_price numeric(12,2),
  ADD COLUMN IF NOT EXISTS stock integer,
  ADD COLUMN IF NOT EXISTS status public.variation_status NOT NULL DEFAULT 'active';

-- 4) Extend product_images with is_primary flag
ALTER TABLE public.product_images
  ADD COLUMN IF NOT EXISTS is_primary boolean NOT NULL DEFAULT false;

-- 5) product_downloads table
CREATE TABLE IF NOT EXISTS public.product_downloads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_url text NOT NULL,
  version text,
  file_size bigint,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.product_downloads TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_downloads TO authenticated;
GRANT ALL ON public.product_downloads TO service_role;

ALTER TABLE public.product_downloads ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Public read product downloads metadata"
    ON public.product_downloads FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Admins manage product downloads"
    ON public.product_downloads FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'admin'::public.app_role))
    WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_product_downloads_product ON public.product_downloads(product_id);

DROP TRIGGER IF EXISTS trg_product_downloads_updated ON public.product_downloads;
CREATE TRIGGER trg_product_downloads_updated
  BEFORE UPDATE ON public.product_downloads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
