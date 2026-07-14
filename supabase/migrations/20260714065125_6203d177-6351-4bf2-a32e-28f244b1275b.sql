DROP FUNCTION IF EXISTS public.submit_manual_payment_proof(text, text, text, text, text, text, text, text, jsonb);
DROP FUNCTION IF EXISTS public.submit_manual_payment_proof(text, text, text, text, text, text, text, text);

CREATE OR REPLACE FUNCTION public.submit_manual_payment_proof(
  _order_number text,
  _gateway_slug text,
  _field_values jsonb DEFAULT '{}'::jsonb,
  _note text DEFAULT NULL,
  _email text DEFAULT NULL
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
    order_id,
    gateway_id,
    gateway_slug,
    user_id,
    email,
    amount,
    currency,
    note,
    status,
    field_values
  ) VALUES (
    ord.id,
    gw.id,
    gw.slug,
    ord.user_id,
    COALESCE(ord.email, _email),
    ord.total,
    ord.currency,
    NULLIF(_note, ''),
    'pending',
    COALESCE(_field_values, '{}'::jsonb)
  ) RETURNING id INTO inserted_id;

  RETURN jsonb_build_object('ok', true, 'id', inserted_id);
END;
$$;

REVOKE ALL ON FUNCTION public.submit_manual_payment_proof(text, text, jsonb, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_manual_payment_proof(text, text, jsonb, text, text) TO anon, authenticated, service_role;