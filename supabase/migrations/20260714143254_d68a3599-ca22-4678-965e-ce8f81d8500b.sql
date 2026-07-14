
-- 1) Subscription path in evaluate_fulfillment: always manual review (no auto-assign).
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

  -- ========= SUBSCRIPTION PATH — manual delivery only =========
  IF prod.product_type = 'subscription'
     OR prod.delivery_type = 'subscription'::public.product_delivery_type THEN
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

  -- ========= LEGACY LICENSE / DOWNLOAD / INVENTORY PATH (unchanged) =========
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
END $function$;

-- 2) New admin action: mark subscription delivered.
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
  prod_type text;
  remaining int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT * INTO f FROM public.order_fulfillments WHERE id = _fulfillment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Fulfillment not found'; END IF;

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

  -- If all fulfillments for the order are delivered, mark order completed.
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

REVOKE ALL ON FUNCTION public.admin_mark_subscription_delivered(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_mark_subscription_delivered(uuid, text) TO authenticated;
