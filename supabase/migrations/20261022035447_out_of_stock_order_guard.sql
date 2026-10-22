-- Prevent checkout from creating order items for products or variants marked unavailable.
-- This is an additive guard: it does not alter existing order/payment/fulfillment data.

CREATE OR REPLACE FUNCTION public.guard_order_item_stock()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  product_row RECORD;
  variant_row RECORD;
  is_variable boolean := false;
BEGIN
  SELECT id, slug, stock_status
    INTO product_row
    FROM public.products
   WHERE id = NEW.product_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'product_not_found';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.product_attributes WHERE product_id = NEW.product_id
  ) INTO is_variable;

  IF NEW.variant_id IS NOT NULL THEN
    SELECT id, stock, stock_status, status, visibility
      INTO variant_row
      FROM public.product_variations
     WHERE id = NEW.variant_id
       AND product_id = NEW.product_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'variant_not_found';
    END IF;

    IF variant_row.status IS DISTINCT FROM 'active'
       OR (variant_row.visibility IS NOT NULL AND variant_row.visibility <> 'public')
       OR variant_row.stock_status = 'out_of_stock'
       OR (variant_row.stock IS NOT NULL AND variant_row.stock <= 0) THEN
      RAISE EXCEPTION 'variant_out_of_stock:%', NEW.product_slug;
    END IF;
  ELSE
    IF is_variable THEN
      RAISE EXCEPTION 'variant_required:%', NEW.product_slug;
    END IF;

    IF product_row.stock_status = 'out_of_stock' THEN
      RAISE EXCEPTION 'product_out_of_stock:%', product_row.slug;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_order_item_stock_before_insert ON public.order_items;

CREATE TRIGGER guard_order_item_stock_before_insert
BEFORE INSERT ON public.order_items
FOR EACH ROW
EXECUTE FUNCTION public.guard_order_item_stock();
