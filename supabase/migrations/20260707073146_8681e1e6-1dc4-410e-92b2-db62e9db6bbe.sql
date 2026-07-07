
-- =====================================================================
-- P2D — Variant commerce integration (backward compatible)
-- =====================================================================

-- 1) Extend order_items with variant fields
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS variant_id uuid REFERENCES public.product_variations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS variant_name text,
  ADD COLUMN IF NOT EXISTS selected_attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS sku_snapshot text,
  ADD COLUMN IF NOT EXISTS thumbnail_snapshot text,
  ADD COLUMN IF NOT EXISTS variant_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS price_snapshot numeric,
  ADD COLUMN IF NOT EXISTS inventory_pool_id_snapshot uuid,
  ADD COLUMN IF NOT EXISTS subscription_pool_id_snapshot uuid,
  ADD COLUMN IF NOT EXISTS license_pool_id_snapshot uuid;

CREATE INDEX IF NOT EXISTS order_items_variant_id_idx ON public.order_items(variant_id);

-- =====================================================================
-- 2) place_order: accept optional variant_id per item and store snapshots
-- =====================================================================
CREATE OR REPLACE FUNCTION public.place_order(
  _items jsonb,
  _customer jsonb,
  _payment_method text,
  _coupon_code text DEFAULT NULL::text
) RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  item jsonb;
  prod RECORD;
  var  RECORD;
  order_num text;
  new_order_id uuid;
  subtotal numeric := 0;
  discount numeric := 0;
  coupon_id uuid := NULL;
  total numeric;
  unit numeric;
  qty int;
  line numeric;
  cust_name text;
  product_ids uuid[] := ARRAY[]::uuid[];
  v jsonb;
  vid uuid;
BEGIN
  IF jsonb_array_length(_items) = 0 THEN RAISE EXCEPTION 'no_items'; END IF;

  -- Pre-compute subtotal + collect product_ids (variant price wins when a variant is provided)
  FOR item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    SELECT id, slug, title, regular_price, sale_price INTO prod
      FROM public.products WHERE slug = item->>'slug' LIMIT 1;
    IF NOT FOUND THEN RAISE EXCEPTION 'product_not_found:%', item->>'slug'; END IF;

    vid := NULLIF(item->>'variant_id','')::uuid;
    IF vid IS NOT NULL THEN
      SELECT id, price, sale_price INTO var
        FROM public.product_variations
        WHERE id = vid AND product_id = prod.id
        LIMIT 1;
      IF FOUND THEN
        unit := COALESCE(NULLIF(var.sale_price, 0), var.price);
      ELSE
        unit := COALESCE(prod.sale_price, prod.regular_price);
      END IF;
    ELSE
      unit := COALESCE(prod.sale_price, prod.regular_price);
    END IF;

    qty := (item->>'qty')::int;
    subtotal := subtotal + (unit * qty);
    product_ids := product_ids || prod.id;
  END LOOP;

  -- Coupon
  IF _coupon_code IS NOT NULL AND length(_coupon_code) > 0 THEN
    v := public.validate_coupon(upper(_coupon_code), subtotal, uid, _customer->>'email', product_ids);
    IF NOT (v->>'ok')::boolean THEN
      RAISE EXCEPTION 'coupon_invalid:%', COALESCE(v->>'reason','unknown');
    END IF;
    discount := COALESCE((v->>'discount')::numeric, 0);
    coupon_id := NULLIF(v->>'coupon_id','')::uuid;
  END IF;

  total := ROUND(subtotal - discount, 2);
  order_num := public.generate_order_number();
  cust_name := NULLIF(TRIM(CONCAT_WS(' ', _customer->>'firstName', _customer->>'lastName')), '');

  INSERT INTO public.orders(
    order_number, user_id, email, customer_name, phone, country, address, notes,
    status, subtotal, discount, total, currency, coupon_code, payment_method
  ) VALUES (
    order_num, uid, _customer->>'email', cust_name,
    NULLIF(_customer->>'phone',''), NULLIF(_customer->>'country',''),
    NULLIF(_customer->>'address',''), NULLIF(_customer->>'notes',''),
    'pending', subtotal, discount, total, 'USD',
    NULLIF(upper(_coupon_code),''), _payment_method
  ) RETURNING id INTO new_order_id;

  -- Order items with variant snapshot
  FOR item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    SELECT id, slug, title, regular_price, sale_price INTO prod
      FROM public.products WHERE slug = item->>'slug' LIMIT 1;

    vid := NULLIF(item->>'variant_id','')::uuid;
    var := NULL;
    IF vid IS NOT NULL THEN
      SELECT * INTO var FROM public.product_variations
        WHERE id = vid AND product_id = prod.id LIMIT 1;
    END IF;

    IF var.id IS NOT NULL THEN
      unit := COALESCE(NULLIF(var.sale_price, 0), var.price);
    ELSE
      unit := COALESCE(prod.sale_price, prod.regular_price);
    END IF;
    qty := (item->>'qty')::int;
    line := unit * qty;

    INSERT INTO public.order_items(
      order_id, product_id, product_slug, product_name,
      unit_price, qty, line_total,
      variant_id, variant_name, selected_attributes,
      sku_snapshot, thumbnail_snapshot, variant_snapshot, price_snapshot,
      inventory_pool_id_snapshot, subscription_pool_id_snapshot, license_pool_id_snapshot
    )
    VALUES (
      new_order_id, prod.id, prod.slug, prod.title,
      unit, qty, line,
      var.id,
      var.name,
      COALESCE(var.attributes, COALESCE((item->'selected_attributes')::jsonb, '{}'::jsonb)),
      var.sku,
      var.thumbnail_url,
      CASE WHEN var.id IS NULL THEN NULL ELSE to_jsonb(var.*) END,
      unit,
      var.inventory_pool_id,
      var.subscription_pool_id,
      var.license_pool_id
    );
  END LOOP;

  INSERT INTO public.payments(order_id, amount, currency, method, status)
    VALUES (new_order_id, total, 'USD', _payment_method, 'pending');

  IF coupon_id IS NOT NULL THEN
    PERFORM public.apply_coupon_usage(coupon_id, new_order_id, uid, _customer->>'email', discount, total);
  END IF;

  RETURN jsonb_build_object('ok', true, 'order_id', new_order_id, 'order_number', order_num, 'total', total);
END;
$function$;

-- =====================================================================
-- 3) assign_inventory_for_order: prefer variant's inventory pool
-- =====================================================================
CREATE OR REPLACE FUNCTION public.assign_inventory_for_order(_order_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  ord public.orders%ROWTYPE;
  item RECORD;
  i int;
  inv RECORD;
  pool_row public.inventory_pools%ROWTYPE;
  assigned_count int := 0;
  new_assignment_id uuid;
BEGIN
  SELECT * INTO ord FROM public.orders WHERE id = _order_id;
  IF NOT FOUND THEN RETURN 0; END IF;

  FOR item IN SELECT * FROM public.order_items WHERE order_id = _order_id LOOP
    -- Prefer variant-level inventory pool when available
    pool_row := NULL;
    IF item.inventory_pool_id_snapshot IS NOT NULL THEN
      SELECT * INTO pool_row FROM public.inventory_pools
        WHERE id = item.inventory_pool_id_snapshot AND is_active = true LIMIT 1;
    END IF;

    IF pool_row.id IS NULL THEN
      SELECT * INTO pool_row FROM public.inventory_pools
        WHERE product_id = item.product_id AND is_active = true
        ORDER BY created_at ASC LIMIT 1;
    END IF;
    IF pool_row.id IS NULL THEN CONTINUE; END IF;

    FOR i IN 1..item.qty LOOP
      IF (SELECT count(*) FROM public.inventory_assignments
          WHERE order_item_id = item.id AND status = 'active') >= item.qty THEN
        EXIT;
      END IF;

      SELECT * INTO inv FROM public.inventory_items
        WHERE pool_id = pool_row.id AND status = 'available'
        ORDER BY created_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED;
      IF NOT FOUND THEN EXIT; END IF;

      UPDATE public.inventory_items
        SET status = 'assigned',
            assigned_order_id = _order_id,
            assigned_user_id = ord.user_id,
            assigned_at = now()
      WHERE id = inv.id;

      INSERT INTO public.inventory_assignments(order_id, order_item_id, product_id, pool_id, item_id, user_id, email)
      VALUES (_order_id, item.id, item.product_id, pool_row.id, inv.id, ord.user_id, ord.email)
      RETURNING id INTO new_assignment_id;

      INSERT INTO public.inventory_logs(pool_id, item_id, assignment_id, action, actor_id, metadata)
      VALUES (pool_row.id, inv.id, new_assignment_id, 'assign', NULL,
              jsonb_build_object('order_id', _order_id, 'variant_id', item.variant_id));

      assigned_count := assigned_count + 1;
    END LOOP;
  END LOOP;

  RETURN assigned_count;
END; $function$;

-- =====================================================================
-- 4) assign_licenses_for_order: prefer variant's license pool
-- =====================================================================
CREATE OR REPLACE FUNCTION public.assign_licenses_for_order(_order_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  item RECORD;
  i INTEGER;
  key_row RECORD;
  assigned INTEGER := 0;
  ord RECORD;
BEGIN
  SELECT * INTO ord FROM public.orders WHERE id = _order_id;
  IF NOT FOUND THEN RETURN 0; END IF;

  FOR item IN SELECT * FROM public.order_items WHERE order_id = _order_id LOOP
    FOR i IN 1..item.qty LOOP
      key_row := NULL;

      IF item.license_pool_id_snapshot IS NOT NULL THEN
        SELECT lk.* INTO key_row FROM public.license_keys lk
          WHERE lk.pool_id = item.license_pool_id_snapshot
            AND lk.status = 'available'
          ORDER BY lk.created_at LIMIT 1 FOR UPDATE SKIP LOCKED;
      END IF;

      IF key_row.id IS NULL THEN
        SELECT lk.* INTO key_row FROM public.license_keys lk
          WHERE lk.product_id = item.product_id AND lk.status = 'available'
          ORDER BY lk.created_at LIMIT 1 FOR UPDATE SKIP LOCKED;
      END IF;

      IF key_row.id IS NOT NULL THEN
        UPDATE public.license_keys SET status='assigned' WHERE id = key_row.id;
        INSERT INTO public.license_assignments(order_item_id, order_id, license_key_id, user_id)
          VALUES (item.id, _order_id, key_row.id, ord.user_id);
        assigned := assigned + 1;
      END IF;
    END LOOP;

    INSERT INTO public.downloads(order_item_id, order_id, user_id, product_id, expires_at)
    VALUES (item.id, _order_id, ord.user_id, item.product_id, now() + interval '30 days');
  END LOOP;

  RETURN assigned;
END; $function$;
