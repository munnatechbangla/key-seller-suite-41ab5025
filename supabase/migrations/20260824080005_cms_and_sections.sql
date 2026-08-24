-- 1. CMS Pages and Sections
CREATE TABLE IF NOT EXISTS public.cms_pages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug text NOT NULL UNIQUE,
    title text NOT NULL,
    description text,
    featured_image text,
    excerpt text,
    body_html text,
    canonical_url text,
    meta_title text,
    meta_description text,
    og_image text,
    og_title text,
    og_description text,
    twitter_image text,
    twitter_card text DEFAULT 'summary_large_image',
    menu_order int DEFAULT 0,
    status text DEFAULT 'draft',
    is_system boolean DEFAULT false,
    published_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cms_sections (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    page_id uuid REFERENCES public.cms_pages(id) ON DELETE CASCADE,
    section_key text NOT NULL,
    section_type text NOT NULL,
    title text,
    subtitle text,
    json_content jsonb DEFAULT '{}'::jsonb,
    sort_order int DEFAULT 0,
    enabled boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cms_navigation (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    menu_name text NOT NULL,
    label text NOT NULL,
    url text NOT NULL,
    icon text,
    target text DEFAULT '_self',
    parent_id uuid REFERENCES public.cms_navigation(id) ON DELETE CASCADE,
    sort_order int DEFAULT 0,
    enabled boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);

-- 2. Featured/Trending/BestSellers (Missing tables)
CREATE TABLE IF NOT EXISTS public.featured_products (
  product_id uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.trending_products (
  product_id uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.best_sellers (
  product_id uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. GRANTS
GRANT ALL ON public.cms_pages, public.cms_sections, public.cms_navigation, public.featured_products, public.trending_products, public.best_sellers TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cms_pages, public.cms_sections, public.cms_navigation, public.featured_products, public.trending_products, public.best_sellers TO authenticated;
GRANT SELECT ON public.cms_pages, public.cms_sections, public.cms_navigation, public.featured_products, public.trending_products, public.best_sellers TO anon;

-- 4. RLS
ALTER TABLE public.cms_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_navigation ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read cms_pages" ON public.cms_pages FOR SELECT USING (status = 'published' OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Public read cms_sections" ON public.cms_sections FOR SELECT USING (enabled OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Public read cms_navigation" ON public.cms_navigation FOR SELECT USING (enabled OR public.has_role(auth.uid(), 'admin'));
