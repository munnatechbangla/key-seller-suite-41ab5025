CREATE OR REPLACE FUNCTION public.assign_licenses_for_order(_order_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  item RECORD;
  i INTEGER;
  found_key_id uuid;
  assigned INTEGER := 0;
  ord RECORD;
BEGIN
  SELECT * INTO ord FROM public.orders WHERE id = _order_id;
  IF NOT FOUND THEN RETURN 0; END IF;

  FOR item IN
    SELECT oi.*, p.product_type, p.delivery_type
    FROM public.order_items oi
    LEFT JOIN public.products p ON p.id = oi.product_id
    WHERE oi.order_id = _order_id
  LOOP
    -- Subscription products are delivered only through the subscription
    -- fulfillment lifecycle. They must never receive license assignments
    -- or legacy download records.
    IF item.product_type = 'subscription' OR item.delivery_type::text = 'subscription' THEN
      CONTINUE;
    END IF;

    FOR i IN 1..item.qty LOOP
      found_key_id := NULL;

      IF item.license_pool_id_snapshot IS NOT NULL THEN
        SELECT lk.id INTO found_key_id FROM public.license_keys lk
          WHERE lk.pool_id = item.license_pool_id_snapshot
            AND lk.status = 'available'
          ORDER BY lk.created_at LIMIT 1 FOR UPDATE SKIP LOCKED;
      END IF;

      IF found_key_id IS NULL THEN
        SELECT lk.id INTO found_key_id FROM public.license_keys lk
          WHERE lk.product_id = item.product_id AND lk.status = 'available'
          ORDER BY lk.created_at LIMIT 1 FOR UPDATE SKIP LOCKED;
      END IF;

      IF found_key_id IS NOT NULL THEN
        UPDATE public.license_keys SET status='assigned' WHERE id = found_key_id;
        INSERT INTO public.license_assignments(order_item_id, order_id, license_key_id, user_id)
          VALUES (item.id, _order_id, found_key_id, ord.user_id);
        assigned := assigned + 1;
      END IF;
    END LOOP;

    INSERT INTO public.downloads(order_item_id, order_id, user_id, product_id, expires_at)
    VALUES (item.id, _order_id, ord.user_id, item.product_id, now() + interval '30 days');
  END LOOP;

  RETURN assigned;
END;
$function$;

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

  FOR item IN
    SELECT oi.*, p.product_type, p.delivery_type
    FROM public.order_items oi
    LEFT JOIN public.products p ON p.id = oi.product_id
    WHERE oi.order_id = _order_id
  LOOP
    -- Subscription products do not use the legacy inventory/account path.
    IF item.product_type = 'subscription' OR item.delivery_type::text = 'subscription' THEN
      CONTINUE;
    END IF;

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
END;
$function$;

CREATE OR REPLACE FUNCTION public.evaluate_fulfillment(_fulfillment_id uuid)
RETURNS fulfillment_status
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  f public.order_fulfillments%ROWTYPE;
  prod RECORD;
  assign RECORD;
  has_pool boolean := false;
  has_download boolean := false;
  new_status public.fulfillment_status;
  d_type text;
BEGIN
  SELECT * INTO f FROM public.order_fulfillments WHERE id = _fulfillment_id FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;

  IF f.fulfillment_status IN ('delivered','cancelled') THEN
    RETURN f.fulfillment_status;
  END IF;

  UPDATE public.order_fulfillments
    SET fulfillment_status = 'processing',
        started_at = COALESCE(started_at, now()),
        attempt_count = attempt_count + 1,
        last_retry_at = CASE WHEN attempt_count > 0 THEN now() ELSE last_retry_at END,
        failure_reason = NULL
    WHERE id = _fulfillment_id;

  SELECT * INTO prod FROM public.products WHERE id = f.product_id;

  -- Subscription products always use the subscription delivery lane.
  IF prod.product_type = 'subscription' OR prod.delivery_type::text = 'subscription' THEN
    new_status := 'manual_review';
    UPDATE public.order_fulfillments
      SET fulfillment_status = new_status,
          delivery_type = 'subscription',
          failure_reason = NULL
      WHERE id = _fulfillment_id;
    PERFORM public.log_fulfillment_event(_fulfillment_id, 'manual_review_required',
      'Awaiting admin to deliver subscription', NULL, '{}'::jsonb);
    RETURN new_status;
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.inventory_pools WHERE product_id = f.product_id AND is_active) INTO has_pool;
  SELECT EXISTS (SELECT 1 FROM public.product_downloads WHERE product_id = f.product_id) INTO has_download;

  IF has_pool THEN d_type := 'inventory';
  ELSIF has_download THEN d_type := 'download';
  ELSE d_type := 'manual';
  END IF;

  IF has_pool THEN
    SELECT * INTO assign
      FROM public.inventory_assignments
      WHERE order_item_id = f.order_item_id AND status = 'active'
      ORDER BY created_at DESC LIMIT 1;
    IF FOUND THEN
      new_status := 'delivered';
      UPDATE public.order_fulfillments
        SET fulfillment_status = new_status, delivery_type = d_type,
            inventory_assignment_id = assign.id, completed_at = now()
        WHERE id = _fulfillment_id;
      PERFORM public.log_fulfillment_event(_fulfillment_id, 'inventory_assigned',
        'Inventory item linked automatically', NULL, jsonb_build_object('assignment_id', assign.id));
      PERFORM public.log_fulfillment_event(_fulfillment_id, 'delivery_completed', NULL, NULL, '{}'::jsonb);
      RETURN new_status;
    END IF;

    new_status := 'waiting_inventory';
    UPDATE public.order_fulfillments
      SET fulfillment_status = new_status, delivery_type = d_type,
          failure_reason = 'No inventory available'
      WHERE id = _fulfillment_id;
    PERFORM public.log_fulfillment_event(_fulfillment_id, 'waiting_inventory', 'No available inventory item', NULL, '{}'::jsonb);
    RETURN new_status;
  END IF;

  IF has_download THEN
    new_status := 'delivered';
    UPDATE public.order_fulfillments
      SET fulfillment_status = new_status, delivery_type = d_type, completed_at = now()
      WHERE id = _fulfillment_id;
    PERFORM public.log_fulfillment_event(_fulfillment_id, 'download_prepared', 'Download links available', NULL, '{}'::jsonb);
    PERFORM public.log_fulfillment_event(_fulfillment_id, 'delivery_completed', NULL, NULL, '{}'::jsonb);
    RETURN new_status;
  END IF;

  new_status := 'manual_review';
  UPDATE public.order_fulfillments
    SET fulfillment_status = new_status, delivery_type = d_type,
        failure_reason = 'Manual fulfillment required'
    WHERE id = _fulfillment_id;
  PERFORM public.log_fulfillment_event(_fulfillment_id, 'manual_review_required',
    'Manual fulfillment required', NULL, '{}'::jsonb);
  RETURN new_status;
END;
$function$;

CREATE OR REPLACE FUNCTION public.mark_order_paid(_order_id uuid, _transaction_id text, _gateway_response jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  ord RECORD;
  pay RECORD;
  assigned INT := 0;
  inv_assigned INT := 0;
  fulfil INT := 0;
BEGIN
  SELECT * INTO ord FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'order_not_found'); END IF;

  IF _transaction_id IS NOT NULL THEN
    PERFORM 1 FROM public.payments WHERE transaction_id = _transaction_id AND order_id <> _order_id;
    IF FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'duplicate_transaction'); END IF;
  END IF;

  IF ord.status NOT IN ('paid', 'completed') THEN
    SELECT * INTO pay FROM public.payments WHERE order_id = _order_id ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
    IF FOUND THEN
      UPDATE public.payments
        SET status = 'paid', paid_at = now(),
            transaction_id = COALESCE(_transaction_id, transaction_id),
            gateway_response = COALESCE(_gateway_response, gateway_response),
            provider_ref = COALESCE(_transaction_id, provider_ref)
        WHERE id = pay.id;
    ELSE
      INSERT INTO public.payments(order_id, amount, currency, method, status, paid_at, transaction_id, gateway_response, provider_ref)
      VALUES (_order_id, ord.total, ord.currency, COALESCE(ord.payment_method,'unknown'), 'paid', now(), _transaction_id, _gateway_response, _transaction_id);
    END IF;

    UPDATE public.orders SET status = 'paid' WHERE id = _order_id;
  END IF;

  SELECT public.assign_licenses_for_order(_order_id) INTO assigned;
  SELECT public.assign_inventory_for_order(_order_id) INTO inv_assigned;
  SELECT public.start_fulfillment_for_order(_order_id) INTO fulfil;

  RETURN jsonb_build_object(
    'ok', true, 'order_id', _order_id,
    'already', ord.status IN ('paid', 'completed'),
    'licenses_assigned', assigned,
    'inventory_assigned', inv_assigned,
    'fulfillments_created', fulfil
  );
END;
$function$;