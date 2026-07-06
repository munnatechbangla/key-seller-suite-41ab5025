
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TABLE public.landing_pages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  page_type TEXT NOT NULL DEFAULT 'custom',
  status TEXT NOT NULL DEFAULT 'draft',
  meta_title TEXT, meta_description TEXT,
  og_title TEXT, og_description TEXT, og_image TEXT,
  canonical_url TEXT, robots TEXT,
  theme JSONB NOT NULL DEFAULT '{}'::jsonb,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.landing_pages TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.landing_pages TO authenticated;
GRANT ALL ON public.landing_pages TO service_role;
ALTER TABLE public.landing_pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lp_public_read" ON public.landing_pages FOR SELECT USING (status = 'published');
CREATE POLICY "lp_admin_all" ON public.landing_pages FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.landing_page_sections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  page_id UUID NOT NULL REFERENCES public.landing_pages(id) ON DELETE CASCADE,
  section_key TEXT NOT NULL,
  section_type TEXT NOT NULL,
  title TEXT, subtitle TEXT,
  json_content JSONB NOT NULL DEFAULT '{}'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.landing_page_sections TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.landing_page_sections TO authenticated;
GRANT ALL ON public.landing_page_sections TO service_role;
ALTER TABLE public.landing_page_sections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lps_public_read" ON public.landing_page_sections FOR SELECT USING (
  enabled = true AND EXISTS (SELECT 1 FROM public.landing_pages p WHERE p.id = page_id AND p.status = 'published')
);
CREATE POLICY "lps_admin_all" ON public.landing_page_sections FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE INDEX idx_lps_page ON public.landing_page_sections(page_id, sort_order);

CREATE TABLE public.landing_page_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  page_type TEXT NOT NULL DEFAULT 'custom',
  preview_image TEXT,
  json_content JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.landing_page_templates TO authenticated;
GRANT ALL ON public.landing_page_templates TO service_role;
ALTER TABLE public.landing_page_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lpt_admin_all" ON public.landing_page_templates FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_lp_updated BEFORE UPDATE ON public.landing_pages FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_lps_updated BEFORE UPDATE ON public.landing_page_sections FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_lpt_updated BEFORE UPDATE ON public.landing_page_templates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
