-- Account variable products: only assign from the exact variant's account pool.
-- Simple Account products use pools where variation_id IS NULL.

CREATE OR REPLACE FUNCTION public.fulfill_account_inventory_for_order(_order_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  ord public.orders%ROWTYPE;
  it RECORD;
  pool_row public.inventory_pools%ROWTYPE;
  inv public.inventory_items%ROWTYPE;
  assignment_id uuid;
  fulfillment_id uuid;
  assigned_count integer := 0;
  missing_count integer := 0;
  i integer;
BEGIN
  SELECT * INTO ord FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND OR ord.status NOT IN ('paid','processing','completed') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'order_not_paid');
  END IF;

  FOR it IN
    SELECT oi.* FROM public.order_items oi
    JOIN public.products p ON p.id = oi.product_id
    WHERE oi.order_id = _order_id AND p.product_type = 'account'
    FOR UPDATE OF oi
  LOOP
    pool_row := NULL;
    IF it.inventory_pool_id_snapshot IS NOT NULL THEN
      SELECT * INTO pool_row FROM public.inventory_pools ip
      WHERE ip.id = it.inventory_pool_id_snapshot AND ip.is_active
        AND ip.inventory_type = 'account' AND ip.product_id = it.product_id
        AND ip.variation_id IS NOT DISTINCT FROM it.variant_id LIMIT 1;
    END IF;
    IF pool_row.id IS NULL THEN
      SELECT * INTO pool_row FROM public.inventory_pools ip
      WHERE ip.product_id = it.product_id AND ip.is_active AND ip.inventory_type = 'account'
        AND ip.variation_id IS NOT DISTINCT FROM it.variant_id
        AND EXISTS (SELECT 1 FROM public.inventory_items ii WHERE ii.pool_id=ip.id
          AND ii.inventory_type='account' AND ii.status='available')
      ORDER BY ip.created_at LIMIT 1;
    END IF;
    IF pool_row.id IS NULL THEN
      SELECT * INTO pool_row FROM public.inventory_pools ip
      WHERE ip.product_id = it.product_id AND ip.is_active AND ip.inventory_type = 'account'
        AND ip.variation_id IS NOT DISTINCT FROM it.variant_id
      ORDER BY ip.created_at LIMIT 1;
    END IF;

    FOR i IN 1..it.qty LOOP
      assignment_id := NULL;
      SELECT ia.id INTO assignment_id FROM public.inventory_assignments ia
      WHERE ia.order_item_id = it.id AND ia.status = 'active'
      ORDER BY ia.created_at OFFSET (i - 1) LIMIT 1;
      IF assignment_id IS NOT NULL THEN CONTINUE; END IF;
      IF pool_row.id IS NULL THEN missing_count := missing_count + 1; CONTINUE; END IF;

      SELECT * INTO inv FROM public.inventory_items
      WHERE pool_id = pool_row.id AND inventory_type = 'account' AND status = 'available'
      ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED;
      IF NOT FOUND THEN missing_count := missing_count + 1; CONTINUE; END IF;

      UPDATE public.inventory_items SET status='assigned', assigned_order_id=_order_id,
        assigned_user_id=ord.user_id, assigned_at=now() WHERE id=inv.id;
      INSERT INTO public.inventory_assignments(order_id,order_item_id,product_id,pool_id,item_id,user_id,email)
      VALUES (_order_id,it.id,it.product_id,pool_row.id,inv.id,ord.user_id,ord.email)
      RETURNING id INTO assignment_id;
      INSERT INTO public.inventory_logs(pool_id,item_id,assignment_id,action,actor_id,metadata)
      VALUES (pool_row.id,inv.id,assignment_id,'assign',NULL,
        jsonb_build_object('order_id',_order_id,'order_item_id',it.id,'workflow','account','variant_id',it.variant_id));
      assigned_count := assigned_count + 1;
    END LOOP;

    SELECT id INTO fulfillment_id FROM public.order_fulfillments
    WHERE order_id=_order_id AND order_item_id=it.id LIMIT 1;
    IF fulfillment_id IS NULL THEN
      INSERT INTO public.order_fulfillments(order_id,order_item_id,product_id,fulfillment_status,delivery_type)
      VALUES (_order_id,it.id,it.product_id,
        CASE WHEN (SELECT count(*) FROM public.inventory_assignments WHERE order_item_id=it.id AND status='active') >= it.qty
          THEN 'delivered'::public.fulfillment_status ELSE 'waiting_inventory'::public.fulfillment_status END,'inventory')
      RETURNING id INTO fulfillment_id;
    ELSE
      UPDATE public.order_fulfillments SET
        fulfillment_status=CASE WHEN (SELECT count(*) FROM public.inventory_assignments WHERE order_item_id=it.id AND status='active') >= it.qty
          THEN 'delivered'::public.fulfillment_status ELSE 'waiting_inventory'::public.fulfillment_status END,
        delivery_type='inventory',
        inventory_assignment_id=(SELECT id FROM public.inventory_assignments WHERE order_item_id=it.id AND status='active' ORDER BY created_at LIMIT 1),
        completed_at=CASE WHEN (SELECT count(*) FROM public.inventory_assignments WHERE order_item_id=it.id AND status='active') >= it.qty THEN now() ELSE NULL END,
        failure_reason=CASE WHEN (SELECT count(*) FROM public.inventory_assignments WHERE order_item_id=it.id AND status='active') >= it.qty THEN NULL ELSE 'Waiting for available account inventory' END
      WHERE id=fulfillment_id;
    END IF;
    UPDATE public.order_fulfillments SET
      inventory_assignment_id=(SELECT id FROM public.inventory_assignments WHERE order_item_id=it.id AND status='active' ORDER BY created_at LIMIT 1),
      completed_at=CASE WHEN (SELECT count(*) FROM public.inventory_assignments WHERE order_item_id=it.id AND status='active') >= it.qty THEN now() ELSE NULL END,
      failure_reason=CASE WHEN (SELECT count(*) FROM public.inventory_assignments WHERE order_item_id=it.id AND status='active') >= it.qty THEN NULL ELSE 'Waiting for available account inventory' END
    WHERE id=fulfillment_id;
  END LOOP;
  RETURN jsonb_build_object('ok',true,'assigned',assigned_count,'waiting_inventory',missing_count);
END;
$function$;

CREATE OR REPLACE FUNCTION public.trg_retry_account_orders_when_stock_added()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE pool_product_id uuid; pool_variant_id uuid; pending_order_id uuid;
BEGIN
  IF NEW.inventory_type <> 'account' OR NEW.status <> 'available' THEN RETURN NEW; END IF;
  SELECT product_id, variation_id INTO pool_product_id, pool_variant_id
  FROM public.inventory_pools WHERE id=NEW.pool_id AND inventory_type='account' AND is_active=true;
  IF pool_product_id IS NULL THEN RETURN NEW; END IF;
  FOR pending_order_id IN
    SELECT o.id FROM public.orders o
    WHERE o.status IN ('paid','processing')
      AND EXISTS (
        SELECT 1 FROM public.order_items oi JOIN public.products p ON p.id=oi.product_id
        WHERE oi.order_id=o.id AND oi.product_id=pool_product_id
          AND oi.variant_id IS NOT DISTINCT FROM pool_variant_id AND p.product_type='account'
          AND (SELECT count(*) FROM public.inventory_assignments ia
               WHERE ia.order_item_id=oi.id AND ia.status='active') < oi.qty
      )
    ORDER BY o.created_at ASC
  LOOP
    PERFORM public.fulfill_account_inventory_for_order(pending_order_id);
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.inventory_items
      WHERE pool_id=NEW.pool_id AND inventory_type='account' AND status='available');
  END LOOP;
  RETURN NEW;
END;
$function$;
