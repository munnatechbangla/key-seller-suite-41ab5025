CREATE OR REPLACE FUNCTION public.trg_retry_account_orders_when_stock_added()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE pool_product_id uuid; pending_order_id uuid;
BEGIN
  IF NEW.inventory_type <> 'account' OR NEW.status <> 'available' THEN RETURN NEW; END IF;
  SELECT product_id INTO pool_product_id FROM public.inventory_pools
  WHERE id=NEW.pool_id AND inventory_type='account' AND is_active=true;
  IF pool_product_id IS NULL THEN RETURN NEW; END IF;
  FOR pending_order_id IN
    SELECT o.id FROM public.orders o
    WHERE o.status IN ('paid','processing')
      AND EXISTS (
        SELECT 1 FROM public.order_items oi
        JOIN public.products p ON p.id=oi.product_id
        WHERE oi.order_id=o.id AND oi.product_id=pool_product_id AND p.product_type='account'
          AND (SELECT count(*) FROM public.inventory_assignments ia
               WHERE ia.order_item_id=oi.id AND ia.status='active') < oi.qty
      )
    ORDER BY o.created_at ASC
  LOOP
    PERFORM public.fulfill_account_inventory_for_order(pending_order_id);
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.inventory_items
      WHERE pool_id=NEW.pool_id AND inventory_type='account' AND status='available'
    );
  END LOOP;
  RETURN NEW;
END;
$function$;