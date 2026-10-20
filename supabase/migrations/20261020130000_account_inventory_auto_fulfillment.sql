-- Account-only automation: assign available account inventory when an order is paid,
-- and retry oldest eligible paid account orders when new account stock is added.
-- Other product workflows are intentionally excluded.
CREATE OR REPLACE FUNCTION public.trg_auto_fulfill_account_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('paid', 'processing', 'completed')
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    IF EXISTS (
      SELECT 1
      FROM public.order_items oi
      JOIN public.products p ON p.id = oi.product_id
      WHERE oi.order_id = NEW.id
        AND p.product_type = 'account'
    ) THEN
      PERFORM public.fulfill_account_inventory_for_order(NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.trg_auto_fulfill_account_order() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_auto_fulfill_account_order ON public.orders;
CREATE TRIGGER trg_auto_fulfill_account_order
AFTER INSERT OR UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.trg_auto_fulfill_account_order();

CREATE OR REPLACE FUNCTION public.trg_retry_account_orders_when_stock_added()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pool_product_id uuid;
  pending_order_id uuid;
BEGIN
  IF NEW.inventory_type <> 'account' OR NEW.status <> 'available' THEN
    RETURN NEW;
  END IF;

  SELECT product_id INTO pool_product_id
  FROM public.inventory_pools
  WHERE id = NEW.pool_id AND inventory_type = 'account' AND is_active = true;

  IF pool_product_id IS NULL THEN
    RETURN NEW;
  END IF;

  FOR pending_order_id IN
    SELECT DISTINCT o.id
    FROM public.orders o
    JOIN public.order_items oi ON oi.order_id = o.id
    JOIN public.products p ON p.id = oi.product_id
    WHERE oi.product_id = pool_product_id
      AND p.product_type = 'account'
      AND o.status IN ('paid', 'processing', 'completed')
      AND (
        SELECT count(*)
        FROM public.inventory_assignments ia
        WHERE ia.order_item_id = oi.id AND ia.status = 'active'
      ) < oi.qty
    ORDER BY o.created_at ASC
  LOOP
    PERFORM public.fulfill_account_inventory_for_order(pending_order_id);
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.inventory_items
      WHERE pool_id = NEW.pool_id AND inventory_type = 'account' AND status = 'available'
    );
  END LOOP;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.trg_retry_account_orders_when_stock_added() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_retry_account_orders_when_stock_added ON public.inventory_items;
CREATE TRIGGER trg_retry_account_orders_when_stock_added
AFTER INSERT ON public.inventory_items
FOR EACH ROW
EXECUTE FUNCTION public.trg_retry_account_orders_when_stock_added();
