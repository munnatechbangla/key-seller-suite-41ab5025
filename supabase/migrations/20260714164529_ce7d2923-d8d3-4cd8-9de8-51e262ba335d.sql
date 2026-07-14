CREATE OR REPLACE FUNCTION public.debug_create_subscription_flow_order(_email text, _deliver boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  prod RECORD;
  ord public.orders%ROWTYPE;
  item public.order_items%ROWTYPE;
  paid jsonb;
  f public.order_fulfillments%ROWTYPE;
  delivered jsonb := NULL;
BEGIN
  IF _email IS NULL OR right(lower(_email), 13) <> '@example.test' THEN
    RAISE EXCEPTION 'Debug helper only accepts @example.test emails';
  END IF;

  SELECT id, title, slug, sale_price, regular_price
  INTO prod
  FROM public.products
  WHERE product_type = 'subscription'
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No subscription product found';
  END IF;

  INSERT INTO public.orders(
    order_number,
    user_id,
    email,
    customer_name,
    customer_first_name,
    customer_last_name,
    total,
    currency,
    status,
    payment_method
  ) VALUES (
    'TH-TEST-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
    NULL,
    lower(_email),
    'Subscription Test',
    'Subscription',
    'Test',
    COALESCE(NULLIF(prod.sale_price, 0), prod.regular_price, 1),
    'USD',
    'pending',
    'sandbox'
  ) RETURNING * INTO ord;

  INSERT INTO public.order_items(
    order_id,
    product_id,
    product_slug,
    product_name,
    qty,
    unit_price,
    line_total,
    thumbnail_snapshot
  ) VALUES (
    ord.id,
    prod.id,
    prod.slug,
    prod.title,
    1,
    COALESCE(NULLIF(prod.sale_price, 0), prod.regular_price, 1),
    COALESCE(NULLIF(prod.sale_price, 0), prod.regular_price, 1),
    NULL
  ) RETURNING * INTO item;

  SELECT public.mark_order_paid(ord.id, 'debug-' || ord.order_number, jsonb_build_object('debug', true)) INTO paid;

  SELECT * INTO f
  FROM public.order_fulfillments
  WHERE order_id = ord.id AND order_item_id = item.id
  ORDER BY created_at DESC
  LIMIT 1;

  IF _deliver AND f.id IS NOT NULL THEN
    UPDATE public.order_fulfillments
      SET fulfillment_status = 'delivered',
          delivery_type = 'subscription',
          completed_at = now(),
          failure_reason = NULL,
          metadata = COALESCE(metadata, '{}'::jsonb)
                     || jsonb_build_object('delivery_note', 'Debug delivery verification', 'delivered_at', now())
      WHERE id = f.id;
    PERFORM public.log_fulfillment_event(f.id, 'subscription_delivered', 'Debug delivery verification', NULL, jsonb_build_object('debug', true));
    UPDATE public.orders SET status = 'completed', updated_at = now() WHERE id = ord.id;
    delivered := jsonb_build_object('ok', true);
  END IF;

  SELECT * INTO f
  FROM public.order_fulfillments
  WHERE order_id = ord.id AND order_item_id = item.id
  ORDER BY created_at DESC
  LIMIT 1;

  RETURN jsonb_build_object(
    'order_id', ord.id,
    'order_number', ord.order_number,
    'order_item_id', item.id,
    'product_id', prod.id,
    'product_name', prod.title,
    'email', ord.email,
    'paid_result', paid,
    'fulfillment_id', f.id,
    'fulfillment_status', f.fulfillment_status,
    'fulfillment_delivery_type', f.delivery_type,
    'delivered_result', delivered
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.debug_create_subscription_flow_order(text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.debug_create_subscription_flow_order(text, boolean) TO service_role;