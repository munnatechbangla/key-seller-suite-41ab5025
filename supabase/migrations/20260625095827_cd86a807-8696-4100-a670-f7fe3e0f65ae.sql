-- 1. Drop the over-permissive public SELECT policy
DROP POLICY IF EXISTS "Public can read enabled gateways" ON public.payment_gateways;

-- 2. Admin-only SELECT on raw table (admins already had ALL via existing policy; keep explicit)
CREATE POLICY "Admins read gateways"
  ON public.payment_gateways FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 3. Safe public function: returns enabled gateways with sanitized config.
CREATE OR REPLACE FUNCTION public.list_public_payment_gateways()
RETURNS TABLE (
  id uuid,
  slug text,
  name text,
  type text,
  logo_url text,
  description text,
  is_enabled boolean,
  mode text,
  sort_order int,
  config jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    g.id,
    g.slug,
    g.name,
    g.type::text,
    g.logo_url,
    g.description,
    g.is_enabled,
    g.mode::text,
    g.sort_order,
    CASE
      WHEN g.type::text = 'manual' THEN
        jsonb_strip_nulls(jsonb_build_object(
          'instructions',            g.config->'instructions',
          'account_name',            g.config->'account_name',
          'account_number',          g.config->'account_number',
          'qr_code_url',             g.config->'qr_code_url',
          'qr_url',                  g.config->'qr_url',
          'require_transaction_id',  g.config->'require_transaction_id',
          'require_screenshot',      g.config->'require_screenshot'
        ))
      ELSE '{}'::jsonb
    END AS config
  FROM public.payment_gateways g
  WHERE g.is_enabled = true
  ORDER BY g.sort_order ASC;
$$;

REVOKE ALL ON FUNCTION public.list_public_payment_gateways() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_public_payment_gateways() TO anon, authenticated;