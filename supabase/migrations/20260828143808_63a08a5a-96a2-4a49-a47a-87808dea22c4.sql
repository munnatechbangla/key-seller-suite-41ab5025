ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cover_url text;

UPDATE public.blog_posts SET published_at = created_at
  WHERE published_at IS NULL AND status = 'published';

ALTER TABLE public.blog_categories
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.blog_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS icon text;