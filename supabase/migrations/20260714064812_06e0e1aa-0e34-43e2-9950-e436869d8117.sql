ALTER TABLE public.manual_payment_submissions
  ADD COLUMN IF NOT EXISTS field_values jsonb NOT NULL DEFAULT '{}'::jsonb;

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
          'instructions',       g.config->'instructions',
          'gateway_info',       g.config->'gateway_info',
          'qr',                 g.config->'qr',
          'customer_fields',    g.config->'customer_fields'
        ))
      ELSE '{}'::jsonb
    END AS config
  FROM public.payment_gateways g
  WHERE g.is_enabled = true
  ORDER BY g.sort_order ASC;
$$;

REVOKE ALL ON FUNCTION public.list_public_payment_gateways() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_public_payment_gateways() TO anon, authenticated;

DROP FUNCTION IF EXISTS public.submit_manual_payment_proof(text, text, text, text, text, text, text, text);

CREATE OR REPLACE FUNCTION public.submit_manual_payment_proof(
  _order_number text,
  _gateway_slug text,
  _transaction_id text DEFAULT NULL,
  _sender_name text DEFAULT NULL,
  _sender_account text DEFAULT NULL,
  _screenshot_url text DEFAULT NULL,
  _note text DEFAULT NULL,
  _email text DEFAULT NULL,
  _field_values jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ord public.orders%ROWTYPE;
  gw public.payment_gateways%ROWTYPE;
  inserted_id uuid;
BEGIN
  SELECT * INTO ord FROM public.orders WHERE order_number = _order_number LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'order_not_found');
  END IF;

  IF ord.user_id IS NOT NULL AND auth.uid() IS DISTINCT FROM ord.user_id THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF _email IS NOT NULL AND ord.email IS NOT NULL AND lower(_email) <> lower(ord.email) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT * INTO gw FROM public.payment_gateways
    WHERE slug = _gateway_slug AND is_enabled = true AND type = 'manual'
    LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'gateway_not_found');
  END IF;

  INSERT INTO public.manual_payment_submissions(
    order_id, gateway_id, gateway_slug, user_id, email, transaction_id,
    sender_name, sender_account, screenshot_url, amount, currency, note, status, field_values
  ) VALUES (
    ord.id, gw.id, gw.slug, ord.user_id, COALESCE(ord.email, _email), NULLIF(_transaction_id, ''),
    NULLIF(_sender_name, ''), NULLIF(_sender_account, ''), NULLIF(_screenshot_url, ''), ord.total, ord.currency, NULLIF(_note, ''), 'pending', COALESCE(_field_values, '{}'::jsonb)
  ) RETURNING id INTO inserted_id;

  RETURN jsonb_build_object('ok', true, 'id', inserted_id);
END;
$$;

REVOKE ALL ON FUNCTION public.submit_manual_payment_proof(text, text, text, text, text, text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_manual_payment_proof(text, text, text, text, text, text, text, text, jsonb) TO anon, authenticated, service_role;