
-- =========================================================
-- P2A — Variant System V2: DB Foundation (additive only)
-- =========================================================

-- 1) Extend legacy product_attributes to double as attribute-definitions
ALTER TABLE public.product_attributes
  ALTER COLUMN value DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS display_type TEXT NOT NULL DEFAULT 'select',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS product_attributes_product_id_idx ON public.product_attributes(product_id);

-- 2) New: product_attribute_options
CREATE TABLE IF NOT EXISTS public.product_attribute_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attribute_id UUID NOT NULL REFERENCES public.product_attributes(id) ON DELETE CASCADE,
  value TEXT NOT NULL,
  label TEXT NOT NULL,
  color TEXT,
  image TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (attribute_id, value)
);

GRANT SELECT ON public.product_attribute_options TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.product_attribute_options TO authenticated;
GRANT ALL ON public.product_attribute_options TO service_role;

ALTER TABLE public.product_attribute_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read attribute options"
  ON public.product_attribute_options FOR SELECT
  USING (true);

CREATE POLICY "Admins manage attribute options"
  ON public.product_attribute_options FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS product_attribute_options_attr_idx
  ON public.product_attribute_options(attribute_id);

DROP TRIGGER IF EXISTS trg_pao_updated ON public.product_attribute_options;
CREATE TRIGGER trg_pao_updated BEFORE UPDATE ON public.product_attribute_options
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3) Extend product_variations with pool refs + variant metadata
ALTER TABLE public.product_variations
  ADD COLUMN IF NOT EXISTS attribute_option_ids UUID[] NOT NULL DEFAULT '{}'::uuid[],
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS delivery_type TEXT,
  ADD COLUMN IF NOT EXISTS inventory_pool_id UUID REFERENCES public.inventory_pools(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS subscription_pool_id UUID REFERENCES public.subscription_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS license_pool_id UUID REFERENCES public.license_pools(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS weight NUMERIC,
  ADD COLUMN IF NOT EXISTS dimensions JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS product_variations_product_id_idx ON public.product_variations(product_id);
CREATE INDEX IF NOT EXISTS product_variations_option_ids_idx
  ON public.product_variations USING GIN (attribute_option_ids);

-- 4) Slug backfill for existing attribute rows (best-effort)
UPDATE public.product_attributes
  SET slug = COALESCE(slug, regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g'))
  WHERE slug IS NULL;
