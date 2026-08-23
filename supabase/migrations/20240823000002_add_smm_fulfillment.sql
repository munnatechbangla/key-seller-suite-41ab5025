-- Phase 3: SMM Service Order Fulfillment Workflow

-- 1. Create SMM status enum if it doesn't exist
DO $$ BEGIN
    CREATE TYPE public.smm_order_status AS ENUM ('pending', 'processing', 'partial', 'completed', 'cancelled', 'refunded');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Add SMM fulfillment tracking to order_items
-- We use a single JSONB column for flexibility and to avoid schema bloat
-- Structure: { "status": "pending", "delivered_quantity": 0, "admin_notes": "", "last_updated": "..." }
ALTER TABLE public.order_items 
ADD COLUMN IF NOT EXISTS smm_fulfillment jsonb DEFAULT NULL;

-- 3. Add index for performance on JSONB queries
CREATE INDEX IF NOT EXISTS idx_order_items_smm_fulfillment ON public.order_items USING gin (smm_fulfillment);

-- 4. Create a function to update SMM fulfillment safely
CREATE OR REPLACE FUNCTION public.update_smm_fulfillment(
  _order_item_id uuid,
  _status public.smm_order_status,
  _delivered_quantity integer,
  _admin_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _item_qty integer;
  _current_smm_fulfillment jsonb;
  _new_fulfillment jsonb;
BEGIN
  -- 1. Check if user is admin
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can update SMM fulfillment';
  END IF;

  -- 2. Get the item and its quantity
  SELECT qty, smm_fulfillment INTO _item_qty, _current_smm_fulfillment
  FROM public.order_items
  WHERE id = _order_item_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order item not found';
  END IF;

  -- 3. Validate quantity
  IF _delivered_quantity < 0 THEN
    RAISE EXCEPTION 'Delivered quantity cannot be negative';
  END IF;

  IF _delivered_quantity > _item_qty THEN
    RAISE EXCEPTION 'Delivered quantity cannot exceed ordered quantity';
  END IF;

  -- 4. Build the new fulfillment object
  _new_fulfillment = jsonb_build_object(
    'status', _status,
    'delivered_quantity', _delivered_quantity,
    'remaining_quantity', _item_qty - _delivered_quantity,
    'admin_notes', COALESCE(_admin_notes, _current_smm_fulfillment->>'admin_notes', ''),
    'updated_at', now()
  );

  -- 5. Update the order item
  UPDATE public.order_items
  SET smm_fulfillment = _new_fulfillment
  WHERE id = _order_item_id;

  RETURN _new_fulfillment;
END;
$$;

-- 5. Grant permissions
GRANT EXECUTE ON FUNCTION public.update_smm_fulfillment(uuid, public.smm_order_status, integer, text) TO authenticated;

-- Comment for documentation
COMMENT ON COLUMN public.order_items.smm_fulfillment IS 'Stores SMM specific fulfillment state: status, delivered_quantity, remaining_quantity, admin_notes';
