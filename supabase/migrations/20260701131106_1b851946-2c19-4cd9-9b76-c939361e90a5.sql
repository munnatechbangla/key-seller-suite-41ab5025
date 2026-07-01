CREATE OR REPLACE FUNCTION public.admin_mark_order_paid(
  _order_id uuid,
  _transaction_id text,
  _gateway_response jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  RETURN public.mark_order_paid(_order_id, _transaction_id, _gateway_response);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_mark_order_failed(
  _order_id uuid,
  _reason text DEFAULT NULL,
  _gateway_response jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  RETURN public.mark_order_failed(_order_id, _reason, _gateway_response);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_mark_order_paid(uuid, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_mark_order_failed(uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_mark_order_paid(uuid, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_mark_order_failed(uuid, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_mark_order_paid(uuid, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_mark_order_failed(uuid, text, jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.submit_manual_payment_proof(
  _order_number text,
  _gateway_slug text,
  _transaction_id text DEFAULT NULL,
  _sender_name text DEFAULT NULL,
  _sender_account text DEFAULT NULL,
  _screenshot_url text DEFAULT NULL,
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
    order_id, gateway_id, gateway_slug, user_id, email, transaction_id,
    sender_name, sender_account, screenshot_url, amount, currency, note, status
  ) VALUES (
    ord.id, gw.id, gw.slug, ord.user_id, COALESCE(ord.email, _email), NULLIF(_transaction_id, ''),
    NULLIF(_sender_name, ''), NULLIF(_sender_account, ''), NULLIF(_screenshot_url, ''), ord.total, ord.currency, NULLIF(_note, ''), 'pending'
  ) RETURNING id INTO inserted_id;

  RETURN jsonb_build_object('ok', true, 'id', inserted_id);
END;
$$;

REVOKE ALL ON FUNCTION public.submit_manual_payment_proof(text, text, text, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_manual_payment_proof(text, text, text, text, text, text, text, text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_order_summary_by_number(
  _order_number text,
  _email text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ord public.orders%ROWTYPE;
  items jsonb := '[]'::jsonb;
  payments_json jsonb := '[]'::jsonb;
  assignments_json jsonb := '[]'::jsonb;
  payment_status text := 'pending';
BEGIN
  SELECT * INTO ord FROM public.orders WHERE order_number = _order_number LIMIT 1;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF ord.user_id IS NOT NULL AND auth.uid() IS DISTINCT FROM ord.user_id AND NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    IF _email IS NULL OR lower(_email) <> lower(ord.email) THEN
      RAISE EXCEPTION 'Forbidden';
    END IF;
  END IF;

  IF _email IS NOT NULL AND ord.email IS NOT NULL AND lower(_email) <> lower(ord.email) THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(oi) ORDER BY oi.created_at), '[]'::jsonb)
    INTO items
    FROM public.order_items oi
    WHERE oi.order_id = ord.id;

  SELECT COALESCE(jsonb_agg(to_jsonb(p) ORDER BY p.created_at DESC), '[]'::jsonb)
    INTO payments_json
    FROM public.payments p
    WHERE p.order_id = ord.id;

  SELECT COALESCE((SELECT p.status FROM public.payments p WHERE p.order_id = ord.id ORDER BY p.created_at DESC LIMIT 1), 'pending')
    INTO payment_status;

  IF ord.status = 'paid' OR ord.status = 'completed' OR public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', la.id,
      'order_item_id', la.order_item_id,
      'license_keys', jsonb_build_object('key_value', lk.key_value)
    ) ORDER BY la.assigned_at), '[]'::jsonb)
      INTO assignments_json
      FROM public.license_assignments la
      LEFT JOIN public.license_keys lk ON lk.id = la.license_key_id
      WHERE la.order_id = ord.id;
  END IF;

  RETURN jsonb_build_object(
    'order', to_jsonb(ord),
    'items', items,
    'payments', payments_json,
    'assignments', assignments_json,
    'paymentStatus', payment_status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_order_summary_by_number(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_order_summary_by_number(text, text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.record_coupon_usage_for_order(
  _coupon_id uuid,
  _order_id uuid,
  _email text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ord public.orders%ROWTYPE;
  c public.coupons%ROWTYPE;
BEGIN
  SELECT * INTO ord FROM public.orders WHERE id = _order_id LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'order_not_found');
  END IF;

  IF ord.user_id IS NOT NULL AND auth.uid() IS DISTINCT FROM ord.user_id THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF _email IS NOT NULL AND ord.email IS NOT NULL AND lower(_email) <> lower(ord.email) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT * INTO c FROM public.coupons WHERE id = _coupon_id LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'coupon_not_found');
  END IF;

  IF upper(COALESCE(ord.coupon_code, '')) <> upper(c.code) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'coupon_mismatch');
  END IF;

  INSERT INTO public.coupon_usage(coupon_id, order_id, user_id, email, discount_amount, order_total)
    VALUES (c.id, ord.id, ord.user_id, COALESCE(ord.email, _email), ord.discount, ord.total)
    ON CONFLICT DO NOTHING;
  UPDATE public.coupons
    SET used_count = used_count + 1,
        revenue_generated = revenue_generated + ord.total
    WHERE id = c.id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.record_coupon_usage_for_order(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_coupon_usage_for_order(uuid, uuid, text) TO anon, authenticated, service_role;