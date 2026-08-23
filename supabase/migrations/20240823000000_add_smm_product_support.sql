-- Add 'smm_service' to product_type enum if it doesn't exist
-- Note: PostgreSQL doesn't support IF NOT EXISTS for adding enum values easily in a single statement.
-- We use a DO block to safely add it.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'product_type' AND e.enumlabel = 'smm_service') THEN
    ALTER TYPE public.product_type ADD VALUE 'smm_service';
  END IF;
END
$$;

-- Add SMM configuration column to products table
-- We use JSONB for flexibility and to avoid table bloat, as requested.
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS smm_config JSONB DEFAULT NULL;

COMMENT ON COLUMN public.products.smm_config IS 'SMM Service configuration (platform, service_type, min_qty, max_qty, quantity_step, pricing_mode, price)';
