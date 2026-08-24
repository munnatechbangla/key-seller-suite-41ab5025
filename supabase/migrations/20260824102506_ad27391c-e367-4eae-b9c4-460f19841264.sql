-- Part 1: Orders Extensions
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS order_number text,
  ADD COLUMN IF NOT EXISTS total numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS currency text DEFAULT 'BDT',
  ADD COLUMN IF NOT EXISTS customer_name text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS phone text;

-- Part 2: Enums
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'fulfillment_status') THEN
        CREATE TYPE public.fulfillment_status AS ENUM ('pending', 'processing', 'partial', 'completed', 'cancelled', 'failed');
    END IF;
END $$;

-- Part 3: Order Items
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS smm_fulfillment jsonb DEFAULT '{}'::jsonb;

-- Part 4: RPC Polishing
ALTER FUNCTION public.list_public_payment_gateways() SET search_path = public;
