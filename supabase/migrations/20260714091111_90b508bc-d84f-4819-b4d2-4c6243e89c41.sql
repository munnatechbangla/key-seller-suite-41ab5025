CREATE OR REPLACE FUNCTION public.submit_manual_payment_proof(
  _order_number text,
  _gateway_slug text,
  _field_values jsonb DEFAULT '{}'::jsonb,
  _note text DEFAULT NULL,
  _email text DEFAULT NULL,
  _screenshot_url text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ord public.orders%ROWTYPE;
  gw public.payment_gateways%ROWTYPE;
  inserted_id uuid;
  fv jsonb := COALESCE(_field_values, '{}'::jsonb);
  _txn text;
  _sname text;
  _sacct text;
BEGIN
  SELECT * INTO ord FROM public.orders WHERE order_number = _order_number LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'order_not_found'); END IF;
  IF ord.user_id IS NOT NULL AND auth.uid() IS DISTINCT FROM ord.user_id THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF _email IS NOT NULL AND ord.email IS NOT NULL AND lower(_email) <> lower(ord.email) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT * INTO gw FROM public.payment_gateways
    WHERE slug = _gateway_slug AND is_enabled = true AND type = 'manual' LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'gateway_not_found'); END IF;

  _txn := NULLIF(COALESCE(fv->>'transaction_id', fv->>'txn_id', fv->>'trxid', fv->>'trx_id'), '');
  _sname := NULLIF(COALESCE(fv->>'sender_name', fv->>'name'), '');
  _sacct := NULLIF(COALESCE(fv->>'sender_account', fv->>'account', fv->>'sender_number', fv->>'phone'), '');

  INSERT INTO public.manual_payment_submissions(
    order_id, gateway_id, gateway_slug, user_id, email, amount, currency, note, status,
    field_values, screenshot_url, transaction_id, sender_name, sender_account
  ) VALUES (
    ord.id, gw.id, gw.slug, ord.user_id, COALESCE(ord.email, _email),
    ord.total, ord.currency, NULLIF(_note, ''), 'pending',
    fv, NULLIF(_screenshot_url, ''), _txn, _sname, _sacct
  ) RETURNING id INTO inserted_id;

  RETURN jsonb_build_object('ok', true, 'id', inserted_id);
END; $$;