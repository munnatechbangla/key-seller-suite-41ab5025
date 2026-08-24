-- 1. Infrastructure Tables
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id uuid,
    actor_email text,
    action text,
    entity_type text,
    entity_id text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now()
);

-- 2. Blog Tables
CREATE TABLE IF NOT EXISTS public.blog_posts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    slug text NOT NULL UNIQUE,
    content text,
    excerpt text,
    thumbnail_url text,
    status text DEFAULT 'draft',
    post_type text DEFAULT 'post',
    category_id uuid,
    tag_ids uuid[] DEFAULT '{}'::uuid[],
    author_id uuid,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.blog_categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    slug text NOT NULL UNIQUE,
    kind text DEFAULT 'blog',
    description text,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.blog_tags (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    slug text NOT NULL UNIQUE,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.blog_comments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id uuid REFERENCES public.blog_posts(id) ON DELETE CASCADE,
    user_id uuid,
    content text,
    status text DEFAULT 'pending',
    created_at timestamptz DEFAULT now()
);

-- 3. FAQ table
CREATE TABLE IF NOT EXISTS public.product_faqs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  question text NOT NULL,
  answer text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Missing columns in order_items
ALTER TABLE public.order_items 
  ADD COLUMN IF NOT EXISTS product_name text DEFAULT '',
  ADD COLUMN IF NOT EXISTS product_slug text DEFAULT '',
  ADD COLUMN IF NOT EXISTS variation_id uuid,
  ADD COLUMN IF NOT EXISTS license_pool_id_snapshot uuid;

-- 5. Missing columns in products
ALTER TABLE public.products 
  ADD COLUMN IF NOT EXISTS is_subscription boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_trending boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_best_seller boolean DEFAULT false;

-- 6. Fulfillment Function
CREATE OR REPLACE FUNCTION public.start_fulfillment_for_order(_order_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Logic handled in server functions for now, this just satisfies the RPC call
  RETURN;
END;
$$;

-- 7. GRANTS
GRANT ALL ON public.audit_logs, public.blog_posts, public.blog_categories, public.blog_tags, public.blog_comments, public.product_faqs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audit_logs, public.blog_posts, public.blog_categories, public.blog_tags, public.blog_comments, public.product_faqs TO authenticated;
GRANT SELECT ON public.blog_posts, public.blog_categories, public.blog_tags, public.blog_comments, public.product_faqs TO anon;
