-- 1. Sync Payment Gateway schema
ALTER TABLE public.payment_gateways
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS mode text DEFAULT 'live',
  ADD COLUMN IF NOT EXISTS is_enabled boolean DEFAULT true;

-- 2. Public RPC for gateways
CREATE OR REPLACE FUNCTION public.list_public_payment_gateways()
RETURNS jsonb LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RETURN (
    SELECT json_agg(t)
    FROM (
      SELECT name, slug, type, logo_url, description, mode, sort_order
      FROM public.payment_gateways
      WHERE is_enabled = true AND is_active = true
      ORDER BY sort_order ASC
    ) t
  );
END;
$$;

-- 3. Policy fix for gateways
DROP POLICY IF EXISTS "Public can view active gateways" ON public.payment_gateways;
CREATE POLICY "Public can view active gateways" ON public.payment_gateways FOR SELECT TO anon, authenticated USING (is_enabled = true AND is_active = true);
