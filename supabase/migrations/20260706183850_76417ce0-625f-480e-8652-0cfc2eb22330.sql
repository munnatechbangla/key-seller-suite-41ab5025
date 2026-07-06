
CREATE TABLE public.cms_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  meta_title TEXT,
  meta_description TEXT,
  og_title TEXT,
  og_description TEXT,
  og_image TEXT,
  canonical_url TEXT,
  robots TEXT DEFAULT 'index,follow',
  page_type TEXT NOT NULL DEFAULT 'standard',
  status TEXT NOT NULL DEFAULT 'draft',
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.cms_pages TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cms_pages TO authenticated;
GRANT ALL ON public.cms_pages TO service_role;
ALTER TABLE public.cms_pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cms_pages public read published" ON public.cms_pages FOR SELECT USING (status = 'published');
CREATE POLICY "cms_pages admin all" ON public.cms_pages FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER cms_pages_set_updated_at BEFORE UPDATE ON public.cms_pages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.cms_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID NOT NULL REFERENCES public.cms_pages(id) ON DELETE CASCADE,
  section_key TEXT NOT NULL,
  section_type TEXT NOT NULL,
  title TEXT,
  subtitle TEXT,
  json_content JSONB NOT NULL DEFAULT '{}'::jsonb,
  sort_order INT NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX cms_sections_page_idx ON public.cms_sections(page_id, sort_order);
GRANT SELECT ON public.cms_sections TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cms_sections TO authenticated;
GRANT ALL ON public.cms_sections TO service_role;
ALTER TABLE public.cms_sections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cms_sections public read enabled" ON public.cms_sections FOR SELECT USING (enabled = true);
CREATE POLICY "cms_sections admin all" ON public.cms_sections FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER cms_sections_set_updated_at BEFORE UPDATE ON public.cms_sections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.cms_navigation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_name TEXT NOT NULL,
  label TEXT NOT NULL,
  url TEXT NOT NULL DEFAULT '#',
  icon TEXT,
  target TEXT DEFAULT '_self',
  parent_id UUID REFERENCES public.cms_navigation(id) ON DELETE CASCADE,
  sort_order INT NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX cms_navigation_menu_idx ON public.cms_navigation(menu_name, sort_order);
GRANT SELECT ON public.cms_navigation TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cms_navigation TO authenticated;
GRANT ALL ON public.cms_navigation TO service_role;
ALTER TABLE public.cms_navigation ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cms_nav public read enabled" ON public.cms_navigation FOR SELECT USING (enabled = true);
CREATE POLICY "cms_nav admin all" ON public.cms_navigation FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER cms_navigation_set_updated_at BEFORE UPDATE ON public.cms_navigation
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.cms_footer (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_name TEXT NOT NULL,
  json_content JSONB NOT NULL DEFAULT '{}'::jsonb,
  sort_order INT NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.cms_footer TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cms_footer TO authenticated;
GRANT ALL ON public.cms_footer TO service_role;
ALTER TABLE public.cms_footer ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cms_footer public read enabled" ON public.cms_footer FOR SELECT USING (enabled = true);
CREATE POLICY "cms_footer admin all" ON public.cms_footer FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER cms_footer_set_updated_at BEFORE UPDATE ON public.cms_footer
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
