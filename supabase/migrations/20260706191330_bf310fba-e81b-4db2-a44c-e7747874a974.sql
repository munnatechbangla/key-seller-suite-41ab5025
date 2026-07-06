
CREATE TABLE IF NOT EXISTS public.product_content_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  block_type text NOT NULL,
  json_content jsonb NOT NULL DEFAULT '{}'::jsonb,
  enabled boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS product_content_blocks_product_idx
  ON public.product_content_blocks(product_id, sort_order);

GRANT SELECT ON public.product_content_blocks TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_content_blocks TO authenticated;
GRANT ALL ON public.product_content_blocks TO service_role;

ALTER TABLE public.product_content_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read enabled product content blocks"
  ON public.product_content_blocks FOR SELECT
  USING (enabled = true);

CREATE POLICY "Admins manage product_content_blocks"
  ON public.product_content_blocks FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_product_content_blocks_updated
  BEFORE UPDATE ON public.product_content_blocks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
