-- Reviews System: status enum, display fields, verified purchase, moderation, rating sync
DO $$ BEGIN
  CREATE TYPE public.review_status AS ENUM ('pending','approved','rejected');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE public.product_reviews
  ADD COLUMN IF NOT EXISTS status public.review_status NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS order_item_id UUID REFERENCES public.order_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS admin_reply TEXT,
  ADD COLUMN IF NOT EXISTS admin_reply_at TIMESTAMPTZ;

UPDATE public.product_reviews SET status = 'approved' WHERE is_approved IS TRUE AND status = 'pending';

CREATE OR REPLACE FUNCTION public.sync_review_approved()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.is_approved := (NEW.status = 'approved');
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_review_sync_approved ON public.product_reviews;
CREATE TRIGGER trg_review_sync_approved
  BEFORE INSERT OR UPDATE ON public.product_reviews
  FOR EACH ROW EXECUTE FUNCTION public.sync_review_approved();

CREATE UNIQUE INDEX IF NOT EXISTS uniq_review_per_order_item
  ON public.product_reviews(order_item_id) WHERE order_item_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reviews_product_status ON public.product_reviews(product_id, status);
CREATE INDEX IF NOT EXISTS idx_reviews_status_created ON public.product_reviews(status, created_at DESC);

CREATE OR REPLACE FUNCTION public.recalc_product_rating(_product_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE avg_r NUMERIC; cnt INT;
BEGIN
  SELECT COALESCE(ROUND(AVG(rating)::numeric, 2), 0), COUNT(*)
    INTO avg_r, cnt
    FROM public.product_reviews
    WHERE product_id = _product_id AND status = 'approved';
  UPDATE public.products SET rating = avg_r, reviews_count = cnt WHERE id = _product_id;
END; $$;

CREATE OR REPLACE FUNCTION public.trg_recalc_rating_fn()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalc_product_rating(OLD.product_id);
    RETURN OLD;
  END IF;
  PERFORM public.recalc_product_rating(NEW.product_id);
  IF TG_OP = 'UPDATE' AND OLD.product_id <> NEW.product_id THEN
    PERFORM public.recalc_product_rating(OLD.product_id);
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_reviews_recalc ON public.product_reviews;
CREATE TRIGGER trg_reviews_recalc
  AFTER INSERT OR UPDATE OR DELETE ON public.product_reviews
  FOR EACH ROW EXECUTE FUNCTION public.trg_recalc_rating_fn();

CREATE OR REPLACE FUNCTION public.user_purchased_product(_user_id uuid, _product_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    WHERE oi.product_id = _product_id
      AND o.user_id = _user_id
      AND o.status IN ('paid','completed')
  );
$$;

-- Refresh policies (drop and recreate to ensure correct anon read on approved)
DROP POLICY IF EXISTS "Public read approved reviews" ON public.product_reviews;
CREATE POLICY "Public read approved reviews" ON public.product_reviews
  FOR SELECT
  USING (
    status = 'approved'
    OR (auth.uid() IS NOT NULL AND auth.uid() = user_id)
    OR public.has_role(auth.uid(), 'admin')
  );

GRANT SELECT ON public.product_reviews TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_reviews TO authenticated;
GRANT ALL ON public.product_reviews TO service_role;