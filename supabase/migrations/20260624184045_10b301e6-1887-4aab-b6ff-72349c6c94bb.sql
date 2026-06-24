
ALTER TABLE public.products
  ADD COLUMN emoji text,
  ADD COLUMN delivery_time text,
  ADD COLUMN badge text,
  ADD COLUMN rating numeric(3,2) NOT NULL DEFAULT 0,
  ADD COLUMN reviews_count int NOT NULL DEFAULT 0,
  ADD COLUMN features text[] NOT NULL DEFAULT '{}',
  ADD COLUMN included text[] NOT NULL DEFAULT '{}',
  ADD COLUMN specs jsonb NOT NULL DEFAULT '{}'::jsonb;
