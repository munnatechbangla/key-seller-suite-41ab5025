-- Add 'smm_service' to product_type enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'product_type' AND e.enumlabel = 'smm_service') THEN
    ALTER TYPE public.product_type ADD VALUE 'smm_service';
  END IF;
END
$$;

-- Add 'smm_fulfillment' to delivery_type enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'delivery_type' AND e.enumlabel = 'smm_fulfillment') THEN
    ALTER TYPE public.delivery_type ADD VALUE 'smm_fulfillment';
  END IF;
END
$$;

-- Add SMM configuration column to products table
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS smm_config JSONB DEFAULT NULL;

COMMENT ON COLUMN public.products.smm_config IS 'SMM Service configuration (platform, service_type, min_qty, max_qty, quantity_step, pricing_mode, price)';
