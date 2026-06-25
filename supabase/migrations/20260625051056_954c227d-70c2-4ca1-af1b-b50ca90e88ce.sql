
CREATE TYPE public.coupon_type AS ENUM ('percent','fixed','free_product','free_download');

CREATE TABLE public.coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  description text,
  type public.coupon_type NOT NULL DEFAULT 'percent',
  value numeric(12,2) NOT NULL DEFAULT 0,
  min_order_amount numeric(12,2) DEFAULT 0,
  max_discount numeric(12,2),
  usage_limit integer,
  per_user_limit integer DEFAULT 1,
  first_order_only boolean DEFAULT false,
  new_customer_only boolean DEFAULT false,
  starts_at timestamptz,
  ends_at timestamptz,
  target_product_ids uuid[] DEFAULT '{}',
  target_category_ids uuid[] DEFAULT '{}',
  target_brand_ids uuid[] DEFAULT '{}',
  free_product_id uuid,
  is_active boolean NOT NULL DEFAULT true,
  used_count integer NOT NULL DEFAULT 0,
  revenue_generated numeric(14,2) NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.coupons TO anon, authenticated;
GRANT ALL ON public.coupons TO service_role;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coupons_read_active" ON public.coupons FOR SELECT USING (is_active = true OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "coupons_admin_all" ON public.coupons FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER coupons_updated BEFORE UPDATE ON public.coupons FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.coupon_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id uuid NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id uuid,
  email text,
  discount_amount numeric(12,2) NOT NULL DEFAULT 0,
  order_total numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX coupon_usage_coupon_idx ON public.coupon_usage(coupon_id);
CREATE INDEX coupon_usage_user_idx ON public.coupon_usage(user_id);
CREATE INDEX coupon_usage_email_idx ON public.coupon_usage(email);

GRANT SELECT, INSERT ON public.coupon_usage TO authenticated;
GRANT ALL ON public.coupon_usage TO service_role;
ALTER TABLE public.coupon_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coupon_usage_own" ON public.coupon_usage FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "coupon_usage_admin_all" ON public.coupon_usage FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Validate coupon for a given subtotal + identity. Returns jsonb { ok, reason?, discount, coupon_id, type }.
CREATE OR REPLACE FUNCTION public.validate_coupon(
  _code text,
  _subtotal numeric,
  _user_id uuid DEFAULT NULL,
  _email text DEFAULT NULL,
  _product_ids uuid[] DEFAULT '{}'
) RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c RECORD;
  user_uses INT;
  prior_orders INT;
  eligible_amount NUMERIC := _subtotal;
  discount NUMERIC := 0;
BEGIN
  SELECT * INTO c FROM public.coupons WHERE upper(code) = upper(_code) LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'reason','not_found'); END IF;
  IF NOT c.is_active THEN RETURN jsonb_build_object('ok',false,'reason','inactive'); END IF;
  IF c.starts_at IS NOT NULL AND now() < c.starts_at THEN RETURN jsonb_build_object('ok',false,'reason','not_started'); END IF;
  IF c.ends_at   IS NOT NULL AND now() > c.ends_at   THEN RETURN jsonb_build_object('ok',false,'reason','expired'); END IF;
  IF c.usage_limit IS NOT NULL AND c.used_count >= c.usage_limit THEN RETURN jsonb_build_object('ok',false,'reason','limit_reached'); END IF;
  IF c.min_order_amount IS NOT NULL AND _subtotal < c.min_order_amount THEN
    RETURN jsonb_build_object('ok',false,'reason','min_order','min',c.min_order_amount);
  END IF;

  IF c.per_user_limit IS NOT NULL AND (_user_id IS NOT NULL OR _email IS NOT NULL) THEN
    SELECT count(*) INTO user_uses FROM public.coupon_usage
      WHERE coupon_id = c.id AND ((_user_id IS NOT NULL AND user_id = _user_id) OR (_email IS NOT NULL AND email = _email));
    IF user_uses >= c.per_user_limit THEN RETURN jsonb_build_object('ok',false,'reason','user_limit'); END IF;
  END IF;

  IF c.first_order_only OR c.new_customer_only THEN
    SELECT count(*) INTO prior_orders FROM public.orders
      WHERE status IN ('paid','completed') AND ((_user_id IS NOT NULL AND user_id = _user_id) OR (_email IS NOT NULL AND email = _email));
    IF prior_orders > 0 THEN RETURN jsonb_build_object('ok',false,'reason','not_first_order'); END IF;
  END IF;

  -- Targeting: if any target arrays are set, restrict eligible amount to matching products.
  IF (array_length(c.target_product_ids,1) IS NOT NULL OR array_length(c.target_category_ids,1) IS NOT NULL OR array_length(c.target_brand_ids,1) IS NOT NULL) THEN
    IF _product_ids IS NULL OR array_length(_product_ids,1) IS NULL THEN
      RETURN jsonb_build_object('ok',false,'reason','no_matching_products');
    END IF;
    SELECT COALESCE(sum(p.sale_price), 0) INTO eligible_amount FROM public.products p
      WHERE p.id = ANY(_product_ids)
        AND ( (array_length(c.target_product_ids,1)  IS NOT NULL AND p.id = ANY(c.target_product_ids))
           OR (array_length(c.target_category_ids,1) IS NOT NULL AND p.category_id = ANY(c.target_category_ids))
           OR (array_length(c.target_brand_ids,1)    IS NOT NULL AND p.brand_id    = ANY(c.target_brand_ids)) );
    IF eligible_amount <= 0 THEN RETURN jsonb_build_object('ok',false,'reason','no_matching_products'); END IF;
  END IF;

  IF c.type = 'percent' THEN
    discount := round(eligible_amount * (c.value/100.0), 2);
  ELSIF c.type = 'fixed' THEN
    discount := LEAST(c.value, eligible_amount);
  ELSE
    discount := 0; -- free_product / free_download handled by app layer
  END IF;

  IF c.max_discount IS NOT NULL AND discount > c.max_discount THEN discount := c.max_discount; END IF;
  IF discount > _subtotal THEN discount := _subtotal; END IF;

  RETURN jsonb_build_object('ok',true,'coupon_id',c.id,'code',c.code,'type',c.type,'value',c.value,'discount',discount,'description',c.description);
END;$$;

-- Records a usage row and increments counters. Called from the order placement flow (service_role).
CREATE OR REPLACE FUNCTION public.apply_coupon_usage(
  _coupon_id uuid,
  _order_id uuid,
  _user_id uuid,
  _email text,
  _discount numeric,
  _order_total numeric
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.coupon_usage(coupon_id, order_id, user_id, email, discount_amount, order_total)
    VALUES (_coupon_id, _order_id, _user_id, _email, _discount, _order_total);
  UPDATE public.coupons SET used_count = used_count + 1, revenue_generated = revenue_generated + _order_total WHERE id = _coupon_id;
END;$$;

REVOKE ALL ON FUNCTION public.apply_coupon_usage(uuid,uuid,uuid,text,numeric,numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_coupon_usage(uuid,uuid,uuid,text,numeric,numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.validate_coupon(text,numeric,uuid,text,uuid[]) TO anon, authenticated, service_role;
