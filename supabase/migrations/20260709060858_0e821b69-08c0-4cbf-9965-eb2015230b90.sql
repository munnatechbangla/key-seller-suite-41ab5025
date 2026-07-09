CREATE OR REPLACE FUNCTION public.place_order(_items jsonb, _customer jsonb, _payment_method text, _coupon_code text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  item jsonb;
  prod RECORD;
  var  RECORD;
  has_var boolean := false;
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
  -- resolved per-item values (safe for simple products)
  it_variant_id uuid;
  it_variant_name text;
  it_selected_attrs jsonb;
  it_sku text;
  it_thumb text;
  it_variant_snapshot jsonb;
  it_inv_pool uuid;
  it_sub_pool uuid;
  it_lic_pool uuid;
BEGIN
  IF jsonb_array_length(_items) = 0 THEN RAISE EXCEPTION 'no_items'; END IF;

  FOR item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    SELECT id, slug, title, regular_price, sale_price INTO prod
      FROM public.products WHERE slug = item->>'slug' LIMIT 1;
    IF NOT FOUND THEN RAISE EXCEPTION 'product_not_found:%', item->>'slug'; END IF;

    vid := NULLIF(item->>'variant_id','')::uuid;
    has_var := false;
    IF vid IS NOT NULL THEN
      SELECT id, price, sale_price INTO var
        FROM public.product_variations
        WHERE id = vid AND product_id = prod.id
        LIMIT 1;
      IF FOUND THEN
        has_var := true;
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

  FOR item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    SELECT id, slug, title, regular_price, sale_price INTO prod
      FROM public.products WHERE slug = item->>'slug' LIMIT 1;

    vid := NULLIF(item->>'variant_id','')::uuid;
    has_var := false;
    IF vid IS NOT NULL THEN
      SELECT * INTO var FROM public.product_variations
        WHERE id = vid AND product_id = prod.id LIMIT 1;
      IF FOUND THEN has_var := true; END IF;
    END IF;

    -- Resolve all per-item values into locals FIRST so simple products
    -- never touch the unassigned `var` RECORD inside the INSERT.
    IF has_var THEN
      unit               := COALESCE(NULLIF(var.sale_price, 0), var.price);
      it_variant_id      := var.id;
      it_variant_name    := var.name;
      it_selected_attrs  := COALESCE(var.attributes, '{}'::jsonb);
      it_sku             := var.sku;
      it_thumb           := var.thumbnail_url;
      it_variant_snapshot := to_jsonb(var.*);
      it_inv_pool        := var.inventory_pool_id;
      it_sub_pool        := var.subscription_pool_id;
      it_lic_pool        := var.license_pool_id;
    ELSE
      unit               := COALESCE(prod.sale_price, prod.regular_price);
      it_variant_id      := NULL;
      it_variant_name    := NULL;
      it_selected_attrs  := COALESCE((item->'selected_attributes')::jsonb, '{}'::jsonb);
      it_sku             := NULL;
      it_thumb           := NULL;
      it_variant_snapshot := NULL;
      it_inv_pool        := NULL;
      it_sub_pool        := NULL;
      it_lic_pool        := NULL;
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
      it_variant_id, it_variant_name, it_selected_attrs,
      it_sku, it_thumb, it_variant_snapshot, unit,
      it_inv_pool, it_sub_pool, it_lic_pool
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