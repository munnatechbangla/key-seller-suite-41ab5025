
DO $$ BEGIN
  CREATE TYPE public.custom_field_type AS ENUM (
    'text','email','number','url','password','textarea',
    'select','radio','checkbox','date','phone','country','hidden'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.product_custom_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  label text NOT NULL,
  name text NOT NULL,
  field_type public.custom_field_type NOT NULL DEFAULT 'text',
  placeholder text,
  help_text text,
  default_value text,
  is_required boolean NOT NULL DEFAULT false,
  is_visible boolean NOT NULL DEFAULT true,
  is_enabled boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  min_length integer,
  max_length integer,
  regex_pattern text,
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, name)
);

GRANT SELECT ON public.product_custom_fields TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_custom_fields TO authenticated;
GRANT ALL ON public.product_custom_fields TO service_role;

ALTER TABLE public.product_custom_fields ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Public read enabled custom fields"
    ON public.product_custom_fields FOR SELECT
    USING (is_enabled = true AND is_visible = true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Admins manage custom fields"
    ON public.product_custom_fields FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'admin'::public.app_role))
    WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_pcf_product ON public.product_custom_fields(product_id, sort_order);

DROP TRIGGER IF EXISTS trg_pcf_updated ON public.product_custom_fields;
CREATE TRIGGER trg_pcf_updated
  BEFORE UPDATE ON public.product_custom_fields
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.product_custom_field_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id uuid NOT NULL REFERENCES public.product_custom_fields(id) ON DELETE CASCADE,
  label text NOT NULL,
  value text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.product_custom_field_options TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_custom_field_options TO authenticated;
GRANT ALL ON public.product_custom_field_options TO service_role;

ALTER TABLE public.product_custom_field_options ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Public read field options"
    ON public.product_custom_field_options FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Admins manage field options"
    ON public.product_custom_field_options FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'admin'::public.app_role))
    WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_pcfo_field ON public.product_custom_field_options(field_id, sort_order);
