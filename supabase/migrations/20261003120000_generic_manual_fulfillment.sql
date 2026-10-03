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
    IF item.delivery_type::text = 'manual' THEN
      CONTINUE;
    END IF;

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
    IF item.delivery_type::text = 'manual' THEN
      CONTINUE;
    END IF;

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
  parent_order_id uuid;
  prod RECORD;
  assign RECORD;
  has_pool boolean := false;
  has_download boolean := false;
  new_status public.fulfillment_status;
  d_type text;
BEGIN
  SELECT order_id INTO parent_order_id
    FROM public.order_fulfillments
    WHERE id = _fulfillment_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  PERFORM 1 FROM public.orders WHERE id = parent_order_id FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT * INTO f
    FROM public.order_fulfillments
    WHERE id = _fulfillment_id
    FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF f.order_id IS DISTINCT FROM parent_order_id THEN
    RAISE EXCEPTION 'Fulfillment order changed; retry evaluation';
  END IF;

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

  IF prod.delivery_type::text = 'manual' THEN
    new_status := 'manual_review';
    UPDATE public.order_fulfillments
      SET fulfillment_status = new_status,
          delivery_type = 'manual',
          failure_reason = 'Manual fulfillment required'
      WHERE id = _fulfillment_id;
    PERFORM public.log_fulfillment_event(_fulfillment_id, 'manual_review_required',
      'Awaiting admin to deliver manually', NULL, '{}'::jsonb);
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

CREATE OR REPLACE FUNCTION public.start_fulfillment_for_order(_order_id uuid)
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  it RECORD;
  fid uuid;
  created int := 0;
BEGIN
  PERFORM 1 FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RETURN 0; END IF;

  FOR it IN SELECT * FROM public.order_items WHERE order_id = _order_id LOOP
    SELECT id INTO fid FROM public.order_fulfillments
      WHERE order_id = _order_id AND order_item_id = it.id;

    IF fid IS NULL THEN
      INSERT INTO public.order_fulfillments(order_id, order_item_id, product_id, fulfillment_status)
      VALUES (_order_id, it.id, it.product_id, 'pending')
      RETURNING id INTO fid;
      created := created + 1;
      PERFORM public.log_fulfillment_event(fid, 'payment_received', 'Payment confirmed', NULL, '{}'::jsonb);
      PERFORM public.log_fulfillment_event(fid, 'fulfillment_started', NULL, NULL, '{}'::jsonb);
    END IF;

    PERFORM public.evaluate_fulfillment(fid);
  END LOOP;
  RETURN created;
END $$;

CREATE OR REPLACE FUNCTION public.admin_retry_fulfillment(_fulfillment_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  parent_order_id uuid;
  locked_order_id uuid;
  locked_fulfillment_id uuid;
  new_status public.fulfillment_status;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT order_id INTO parent_order_id FROM public.order_fulfillments WHERE id = _fulfillment_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Fulfillment not found'; END IF;
  SELECT id INTO locked_order_id FROM public.orders WHERE id = parent_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  SELECT id INTO locked_fulfillment_id FROM public.order_fulfillments
    WHERE id = _fulfillment_id AND order_id = parent_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Fulfillment order changed; retry the operation'; END IF;
  PERFORM public.log_fulfillment_event(_fulfillment_id, 'retry_started', 'Admin retry', auth.uid(), '{}'::jsonb);
  SELECT public.evaluate_fulfillment(_fulfillment_id) INTO new_status;
  RETURN jsonb_build_object('ok', true, 'status', new_status);
END $$;

CREATE OR REPLACE FUNCTION public.admin_restart_fulfillment(_fulfillment_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  parent_order_id uuid;
  locked_order_id uuid;
  locked_fulfillment_id uuid;
  new_status public.fulfillment_status;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT order_id INTO parent_order_id FROM public.order_fulfillments WHERE id = _fulfillment_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Fulfillment not found'; END IF;
  SELECT id INTO locked_order_id FROM public.orders WHERE id = parent_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  SELECT id INTO locked_fulfillment_id FROM public.order_fulfillments
    WHERE id = _fulfillment_id AND order_id = parent_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Fulfillment order changed; retry the operation'; END IF;
  UPDATE public.order_fulfillments
    SET fulfillment_status = 'pending', completed_at = NULL, failure_reason = NULL
    WHERE id = _fulfillment_id;
  PERFORM public.log_fulfillment_event(_fulfillment_id, 'fulfillment_restarted', 'Admin restart', auth.uid(), '{}'::jsonb);
  SELECT public.evaluate_fulfillment(_fulfillment_id) INTO new_status;
  RETURN jsonb_build_object('ok', true, 'status', new_status);
END $$;

CREATE OR REPLACE FUNCTION public.admin_cancel_fulfillment(_fulfillment_id uuid, _reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  parent_order_id uuid;
  locked_order_id uuid;
  locked_fulfillment_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT order_id INTO parent_order_id FROM public.order_fulfillments WHERE id = _fulfillment_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Fulfillment not found'; END IF;
  SELECT id INTO locked_order_id FROM public.orders WHERE id = parent_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  SELECT id INTO locked_fulfillment_id FROM public.order_fulfillments
    WHERE id = _fulfillment_id AND order_id = parent_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Fulfillment order changed; retry the operation'; END IF;
  UPDATE public.order_fulfillments
    SET fulfillment_status = 'cancelled', failure_reason = COALESCE(_reason, failure_reason), completed_at = now()
    WHERE id = _fulfillment_id;
  PERFORM public.log_fulfillment_event(_fulfillment_id, 'fulfillment_cancelled', _reason, auth.uid(), '{}'::jsonb);
  RETURN jsonb_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION public.admin_mark_subscription_delivered(
  _fulfillment_id uuid,
  _note text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  f public.order_fulfillments%ROWTYPE;
  parent_order_id uuid;
  ord public.orders%ROWTYPE;
  prod_type text;
  remaining int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT order_id INTO parent_order_id FROM public.order_fulfillments WHERE id = _fulfillment_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Fulfillment not found'; END IF;
  SELECT * INTO ord FROM public.orders WHERE id = parent_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  SELECT * INTO f FROM public.order_fulfillments
    WHERE id = _fulfillment_id AND order_id = parent_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Fulfillment order changed; retry the operation'; END IF;

  SELECT product_type INTO prod_type FROM public.products WHERE id = f.product_id;
  IF prod_type IS DISTINCT FROM 'subscription' AND f.delivery_type IS DISTINCT FROM 'subscription' THEN
    RAISE EXCEPTION 'Not a subscription fulfillment';
  END IF;

  UPDATE public.order_fulfillments
    SET fulfillment_status = 'delivered',
        delivery_type = 'subscription',
        completed_at = now(),
        failure_reason = NULL,
        metadata = COALESCE(metadata, '{}'::jsonb)
                   || jsonb_build_object(
                        'delivery_note', COALESCE(_note, ''),
                        'delivered_at', now()
                      )
    WHERE id = _fulfillment_id;

  PERFORM public.log_fulfillment_event(_fulfillment_id, 'subscription_delivered',
    COALESCE(NULLIF(_note, ''), 'Subscription delivered by admin'),
    auth.uid(), jsonb_build_object('delivered_at', now()));

  SELECT count(*) INTO remaining
    FROM public.order_fulfillments
    WHERE order_id = f.order_id
      AND fulfillment_status NOT IN ('delivered','cancelled');

  IF remaining = 0 THEN
    UPDATE public.orders SET status = 'completed', updated_at = now()
      WHERE id = f.order_id AND status <> 'completed';
  END IF;

  RETURN jsonb_build_object('ok', true, 'order_completed', remaining = 0);
END $function$;

CREATE OR REPLACE FUNCTION public.admin_mark_manual_fulfillment_delivered(_fulfillment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  f public.order_fulfillments%ROWTYPE;
  ord public.orders%ROWTYPE;
  parent_order_id uuid;
  product_delivery_type text;
  remaining integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT order_id INTO parent_order_id
    FROM public.order_fulfillments
    WHERE id = _fulfillment_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Fulfillment not found'; END IF;

  SELECT * INTO ord FROM public.orders WHERE id = parent_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF ord.status NOT IN ('paid', 'processing', 'completed') THEN
    RAISE EXCEPTION 'Order is not eligible for fulfillment';
  END IF;

  SELECT * INTO f
    FROM public.order_fulfillments
    WHERE id = _fulfillment_id
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Fulfillment not found'; END IF;
  IF f.order_id IS DISTINCT FROM parent_order_id THEN
    RAISE EXCEPTION 'Fulfillment order changed; retry the operation';
  END IF;

  SELECT delivery_type::text INTO product_delivery_type
    FROM public.products WHERE id = f.product_id;
  IF product_delivery_type IS DISTINCT FROM 'manual' THEN
    RAISE EXCEPTION 'Fulfillment product is not configured for manual delivery';
  END IF;
  IF f.fulfillment_status IN ('delivered', 'cancelled') THEN
    RAISE EXCEPTION 'Fulfillment is already in a terminal state';
  END IF;

  UPDATE public.order_fulfillments
    SET fulfillment_status = 'delivered',
        delivery_type = 'manual',
        started_at = COALESCE(started_at, now()),
        completed_at = now(),
        failure_reason = NULL
    WHERE id = _fulfillment_id;

  PERFORM public.log_fulfillment_event(
    _fulfillment_id,
    'manual_delivery_completed',
    'Manual fulfillment marked delivered by admin',
    auth.uid(),
    '{}'::jsonb
  );

  SELECT count(*) INTO remaining
    FROM public.order_fulfillments
    WHERE order_id = f.order_id
      AND fulfillment_status NOT IN ('delivered', 'cancelled');

  IF remaining = 0 THEN
    UPDATE public.orders SET status = 'completed', updated_at = now()
      WHERE id = f.order_id AND status <> 'completed';
  END IF;

  RETURN jsonb_build_object('ok', true, 'order_completed', remaining = 0);
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_mark_manual_fulfillment_delivered(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_mark_manual_fulfillment_delivered(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.guard_order_completion_fulfillments()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM NEW.status
     AND EXISTS (
       SELECT 1 FROM public.order_fulfillments
       WHERE order_id = NEW.id
         AND fulfillment_status NOT IN ('delivered', 'cancelled')
     ) THEN
    RAISE EXCEPTION 'Order cannot be completed while fulfillment is outstanding';
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.guard_order_completion_fulfillments() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_orders_require_terminal_fulfillment ON public.orders;
CREATE TRIGGER trg_orders_require_terminal_fulfillment
  BEFORE UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_order_completion_fulfillments();

CREATE OR REPLACE FUNCTION public.guard_fulfillment_completion_order_lock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  order_status public.order_status;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.fulfillment_status IN ('delivered', 'cancelled') THEN
    RETURN NEW;
  END IF;

  SELECT status INTO order_status
    FROM public.orders
    WHERE id = NEW.order_id
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;

  IF order_status = 'completed'
     AND NEW.fulfillment_status NOT IN ('delivered', 'cancelled') THEN
    RAISE EXCEPTION 'Cannot reopen fulfillment for a completed order';
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.guard_fulfillment_completion_order_lock() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_fulfillment_lock_order_before_change ON public.order_fulfillments;
CREATE TRIGGER trg_fulfillment_lock_order_before_change
  BEFORE INSERT OR UPDATE OF order_id, fulfillment_status ON public.order_fulfillments
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_fulfillment_completion_order_lock();