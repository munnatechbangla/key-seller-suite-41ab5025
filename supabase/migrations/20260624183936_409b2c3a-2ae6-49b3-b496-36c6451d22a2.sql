
CREATE TABLE public.product_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid REFERENCES public.product_categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  icon text,
  image_url text,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  seo_title text,
  seo_description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.product_categories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_categories TO authenticated;
GRANT ALL ON public.product_categories TO service_role;
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read active categories" ON public.product_categories FOR SELECT USING (is_active OR has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage categories" ON public.product_categories FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_categories_updated BEFORE UPDATE ON public.product_categories FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.product_brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  logo_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.product_brands TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_brands TO authenticated;
GRANT ALL ON public.product_brands TO service_role;
ALTER TABLE public.product_brands ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read active brands" ON public.product_brands FOR SELECT USING (is_active OR has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage brands" ON public.product_brands FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_brands_updated BEFORE UPDATE ON public.product_brands FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.product_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.product_tags TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_tags TO authenticated;
GRANT ALL ON public.product_tags TO service_role;
ALTER TABLE public.product_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read tags" ON public.product_tags FOR SELECT USING (true);
CREATE POLICY "Admins manage tags" ON public.product_tags FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

CREATE TYPE product_status AS ENUM ('draft','published','archived');
CREATE TYPE stock_state AS ENUM ('in_stock','out_of_stock','on_backorder');

CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  short_description text,
  description text,
  regular_price numeric(12,2) NOT NULL DEFAULT 0,
  sale_price numeric(12,2),
  thumbnail_url text,
  category_id uuid REFERENCES public.product_categories(id) ON DELETE SET NULL,
  brand_id uuid REFERENCES public.product_brands(id) ON DELETE SET NULL,
  sku text,
  stock_status stock_state NOT NULL DEFAULT 'in_stock',
  status product_status NOT NULL DEFAULT 'draft',
  is_featured boolean NOT NULL DEFAULT false,
  is_trending boolean NOT NULL DEFAULT false,
  is_best_seller boolean NOT NULL DEFAULT false,
  is_digital boolean NOT NULL DEFAULT true,
  is_license_key boolean NOT NULL DEFAULT false,
  is_subscription boolean NOT NULL DEFAULT false,
  is_external boolean NOT NULL DEFAULT false,
  external_url text,
  seo_title text,
  seo_description text,
  sales_count int NOT NULL DEFAULT 0,
  views_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_products_status ON public.products(status);
CREATE INDEX idx_products_category ON public.products(category_id);
CREATE INDEX idx_products_brand ON public.products(brand_id);
CREATE INDEX idx_products_created ON public.products(created_at DESC);
GRANT SELECT ON public.products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read published products" ON public.products FOR SELECT USING (status = 'published' OR has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage products" ON public.products FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.product_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  url text NOT NULL,
  alt text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_product_images_product ON public.product_images(product_id);
GRANT SELECT ON public.product_images TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_images TO authenticated;
GRANT ALL ON public.product_images TO service_role;
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read product images" ON public.product_images FOR SELECT USING (true);
CREATE POLICY "Admins manage product images" ON public.product_images FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

CREATE TABLE public.product_variations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name text NOT NULL,
  sku text,
  price numeric(12,2) NOT NULL DEFAULT 0,
  sale_price numeric(12,2),
  stock_status stock_state NOT NULL DEFAULT 'in_stock',
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_product_variations_product ON public.product_variations(product_id);
GRANT SELECT ON public.product_variations TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_variations TO authenticated;
GRANT ALL ON public.product_variations TO service_role;
ALTER TABLE public.product_variations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read variations" ON public.product_variations FOR SELECT USING (true);
CREATE POLICY "Admins manage variations" ON public.product_variations FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_variations_updated BEFORE UPDATE ON public.product_variations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.product_attributes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name text NOT NULL,
  value text NOT NULL,
  sort_order int NOT NULL DEFAULT 0
);
CREATE INDEX idx_product_attributes_product ON public.product_attributes(product_id);
GRANT SELECT ON public.product_attributes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_attributes TO authenticated;
GRANT ALL ON public.product_attributes TO service_role;
ALTER TABLE public.product_attributes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read attributes" ON public.product_attributes FOR SELECT USING (true);
CREATE POLICY "Admins manage attributes" ON public.product_attributes FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

CREATE TABLE public.product_tag_pivot (
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.product_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, tag_id)
);
GRANT SELECT ON public.product_tag_pivot TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_tag_pivot TO authenticated;
GRANT ALL ON public.product_tag_pivot TO service_role;
ALTER TABLE public.product_tag_pivot ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read product tags" ON public.product_tag_pivot FOR SELECT USING (true);
CREATE POLICY "Admins manage product tags" ON public.product_tag_pivot FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

CREATE TABLE public.product_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title text,
  body text,
  is_verified boolean NOT NULL DEFAULT false,
  is_approved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_product_reviews_product ON public.product_reviews(product_id);
GRANT SELECT ON public.product_reviews TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_reviews TO authenticated;
GRANT ALL ON public.product_reviews TO service_role;
ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read approved reviews" ON public.product_reviews FOR SELECT USING (is_approved OR auth.uid() = user_id OR has_role(auth.uid(),'admin'));
CREATE POLICY "Users insert own reviews" ON public.product_reviews FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own reviews" ON public.product_reviews FOR UPDATE TO authenticated USING (auth.uid() = user_id OR has_role(auth.uid(),'admin')) WITH CHECK (auth.uid() = user_id OR has_role(auth.uid(),'admin'));
CREATE POLICY "Delete own or admin reviews" ON public.product_reviews FOR DELETE TO authenticated USING (auth.uid() = user_id OR has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_reviews_updated BEFORE UPDATE ON public.product_reviews FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.product_faqs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  question text NOT NULL,
  answer text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_product_faqs_product ON public.product_faqs(product_id);
GRANT SELECT ON public.product_faqs TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_faqs TO authenticated;
GRANT ALL ON public.product_faqs TO service_role;
ALTER TABLE public.product_faqs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read faqs" ON public.product_faqs FOR SELECT USING (true);
CREATE POLICY "Admins manage faqs" ON public.product_faqs FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_faqs_updated BEFORE UPDATE ON public.product_faqs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.featured_products (
  product_id uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.featured_products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.featured_products TO authenticated;
GRANT ALL ON public.featured_products TO service_role;
ALTER TABLE public.featured_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read featured" ON public.featured_products FOR SELECT USING (true);
CREATE POLICY "Admins manage featured" ON public.featured_products FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

CREATE TABLE public.trending_products (
  product_id uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.trending_products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trending_products TO authenticated;
GRANT ALL ON public.trending_products TO service_role;
ALTER TABLE public.trending_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read trending" ON public.trending_products FOR SELECT USING (true);
CREATE POLICY "Admins manage trending" ON public.trending_products FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

CREATE TABLE public.best_sellers (
  product_id uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.best_sellers TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.best_sellers TO authenticated;
GRANT ALL ON public.best_sellers TO service_role;
ALTER TABLE public.best_sellers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read best sellers" ON public.best_sellers FOR SELECT USING (true);
CREATE POLICY "Admins manage best sellers" ON public.best_sellers FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

CREATE TABLE public.flash_deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  discount_price numeric(12,2) NOT NULL,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_flash_deals_window ON public.flash_deals(starts_at, ends_at);
GRANT SELECT ON public.flash_deals TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.flash_deals TO authenticated;
GRANT ALL ON public.flash_deals TO service_role;
ALTER TABLE public.flash_deals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read active flash deals" ON public.flash_deals FOR SELECT USING ((now() BETWEEN starts_at AND ends_at) OR has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage flash deals" ON public.flash_deals FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
