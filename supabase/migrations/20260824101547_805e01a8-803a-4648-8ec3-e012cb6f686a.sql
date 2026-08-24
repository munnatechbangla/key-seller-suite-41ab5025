-- Part 1: Infrastructure
CREATE TABLE IF NOT EXISTS public.payment_gateways (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug text NOT NULL UNIQUE,
    is_enabled boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.email_templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    template_key text NOT NULL UNIQUE,
    subject text,
    html_body text,
    enabled boolean DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.email_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    template_key text,
    recipient text NOT NULL,
    subject text,
    status text,
    rendered_html text,
    payload jsonb,
    attempts integer DEFAULT 0,
    error_message text,
    provider text,
    sent_at timestamptz,
    created_at timestamptz DEFAULT now()
);

-- Part 2: Content
CREATE TABLE IF NOT EXISTS public.legal_pages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug text NOT NULL UNIQUE,
    title text NOT NULL,
    content text,
    is_active boolean DEFAULT true
);

-- Part 3: Gallery
CREATE TABLE IF NOT EXISTS public.product_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  url text NOT NULL,
  alt text,
  sort_order int NOT NULL DEFAULT 0,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Part 4: Placeholders for build compatibility
CREATE TABLE IF NOT EXISTS public.coupon_usage (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
CREATE TABLE IF NOT EXISTS public.coupons (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
CREATE TABLE IF NOT EXISTS public.downloads (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
CREATE TABLE IF NOT EXISTS public.manual_payment_submissions (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
CREATE TABLE IF NOT EXISTS public.payments (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
CREATE TABLE IF NOT EXISTS public.payment_intents (id uuid PRIMARY KEY DEFAULT gen_random_uuid());

-- Part 5: GRANTS
GRANT ALL ON public.payment_gateways, public.email_templates, public.email_logs, public.legal_pages, public.product_images TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_gateways, public.email_templates, public.email_logs, public.legal_pages, public.product_images TO authenticated;
GRANT SELECT ON public.product_images TO anon;
GRANT ALL ON public.coupon_usage, public.coupons, public.downloads, public.manual_payment_submissions, public.payments, public.payment_intents TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coupon_usage, public.coupons, public.downloads, public.manual_payment_submissions, public.payments, public.payment_intents TO authenticated;
