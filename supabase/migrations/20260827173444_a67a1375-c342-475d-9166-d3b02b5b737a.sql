ALTER TABLE public.product_reviews ADD COLUMN IF NOT EXISTS avatar_url text;

ALTER TABLE public.setup_state
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;

ALTER TABLE public.redirects
  ADD COLUMN IF NOT EXISTS source_path text,
  ADD COLUMN IF NOT EXISTS target_path text,
  ADD COLUMN IF NOT EXISTS enabled boolean NOT NULL DEFAULT true;

UPDATE public.redirects SET source_path = COALESCE(source_path, source), target_path = COALESCE(target_path, destination), enabled = COALESCE(is_active, true);