
-- ============ product_layouts ============
CREATE TABLE IF NOT EXISTS public.product_layouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  is_default boolean NOT NULL DEFAULT false,
  enabled boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.product_layouts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_layouts TO authenticated;
GRANT ALL ON public.product_layouts TO service_role;

ALTER TABLE public.product_layouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read published layouts"
  ON public.product_layouts FOR SELECT
  USING (status = 'published' AND enabled = true);

CREATE POLICY "Admins manage product_layouts"
  ON public.product_layouts FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_product_layouts_updated
  BEFORE UPDATE ON public.product_layouts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Only one default at a time
CREATE UNIQUE INDEX IF NOT EXISTS product_layouts_one_default
  ON public.product_layouts ((is_default)) WHERE is_default = true;

-- ============ product_layout_sections ============
CREATE TABLE IF NOT EXISTS public.product_layout_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  layout_id uuid NOT NULL REFERENCES public.product_layouts(id) ON DELETE CASCADE,
  section_key text NOT NULL,
  section_type text NOT NULL,
  title text,
  subtitle text,
  json_content jsonb NOT NULL DEFAULT '{}'::jsonb,
  enabled boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS product_layout_sections_layout_idx
  ON public.product_layout_sections(layout_id, sort_order);

GRANT SELECT ON public.product_layout_sections TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_layout_sections TO authenticated;
GRANT ALL ON public.product_layout_sections TO service_role;

ALTER TABLE public.product_layout_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read enabled sections of published layouts"
  ON public.product_layout_sections FOR SELECT
  USING (enabled = true AND EXISTS (
    SELECT 1 FROM public.product_layouts pl
    WHERE pl.id = product_layout_sections.layout_id
      AND pl.status = 'published' AND pl.enabled = true
  ));

CREATE POLICY "Admins manage product_layout_sections"
  ON public.product_layout_sections FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_product_layout_sections_updated
  BEFORE UPDATE ON public.product_layout_sections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ products.layout_id (optional) ============
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS layout_id uuid REFERENCES public.product_layouts(id) ON DELETE SET NULL;
