
-- Server-side helper RPCs so admin/webhook/system writes work without a service-role key.
-- All functions are SECURITY DEFINER and validate their inputs.

-- 1) Place order (guest or authenticated). Callable by anon+authenticated.
CREATE OR REPLACE FUNCTION public.place_order(
  _items jsonb,
  _customer jsonb,
  _payment_method text,
  _coupon_code text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  item jsonb;
  prod RECORD;
  order_num text;
  new_order_id uuid;
  subtotal numeric := 0;
  discount numeric := 0;
  coupon_id uuid := NULL;
  total numeric;
  unit numeric;
  qty int;
  line numeric;
  cust_name text;
  product_ids uuid[] := ARRAY[]::uuid[];
  v jsonb;
BEGIN
  IF jsonb_array_length(_items) = 0 THEN RAISE EXCEPTION 'no_items'; END IF;

  -- Pre-compute subtotal + collect product_ids
  FOR item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    SELECT id, slug, title, regular_price, sale_price INTO prod
      FROM public.products WHERE slug = item->>'slug' LIMIT 1;
    IF NOT FOUND THEN RAISE EXCEPTION 'product_not_found:%', item->>'slug'; END IF;
    unit := COALESCE(prod.sale_price, prod.regular_price);
    qty := (item->>'qty')::int;
    subtotal := subtotal + (unit * qty);
    product_ids := product_ids || prod.id;
  END LOOP;

  -- Coupon
  IF _coupon_code IS NOT NULL AND length(_coupon_code) > 0 THEN
    v := public.validate_coupon(upper(_coupon_code), subtotal, uid, _customer->>'email', product_ids);
    IF NOT (v->>'ok')::boolean THEN
      RAISE EXCEPTION 'coupon_invalid:%', COALESCE(v->>'reason','unknown');
    END IF;
    discount := COALESCE((v->>'discount')::numeric, 0);
    coupon_id := NULLIF(v->>'coupon_id','')::uuid;
  END IF;

  total := ROUND(subtotal - discount, 2);
  order_num := public.generate_order_number();
  cust_name := NULLIF(TRIM(CONCAT_WS(' ', _customer->>'firstName', _customer->>'lastName')), '');

  INSERT INTO public.orders(
    order_number, user_id, email, customer_name, phone, country, address, notes,
    status, subtotal, discount, total, currency, coupon_code, payment_method
  ) VALUES (
    order_num, uid, _customer->>'email', cust_name,
    NULLIF(_customer->>'phone',''), NULLIF(_customer->>'country',''),
    NULLIF(_customer->>'address',''), NULLIF(_customer->>'notes',''),
    'pending', subtotal, discount, total, 'USD',
    NULLIF(upper(_coupon_code),''), _payment_method
  ) RETURNING id INTO new_order_id;

  -- Order items
  FOR item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    SELECT id, slug, title, regular_price, sale_price INTO prod
      FROM public.products WHERE slug = item->>'slug' LIMIT 1;
    unit := COALESCE(prod.sale_price, prod.regular_price);
    qty := (item->>'qty')::int;
    line := unit * qty;
    INSERT INTO public.order_items(order_id, product_id, product_slug, product_name, unit_price, qty, line_total)
      VALUES (new_order_id, prod.id, prod.slug, prod.title, unit, qty, line);
  END LOOP;

  -- Pending payment row
  INSERT INTO public.payments(order_id, amount, currency, method, status)
    VALUES (new_order_id, total, 'USD', _payment_method, 'pending');

  IF coupon_id IS NOT NULL THEN
    PERFORM public.apply_coupon_usage(coupon_id, new_order_id, uid, _customer->>'email', discount, total);
  END IF;

  RETURN jsonb_build_object('ok', true, 'order_id', new_order_id, 'order_number', order_num, 'total', total);
END;
$$;

REVOKE ALL ON FUNCTION public.place_order(jsonb, jsonb, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.place_order(jsonb, jsonb, text, text) TO anon, authenticated;

-- 2) Process gateway payment callback by order_number (used by webhooks + sim)
CREATE OR REPLACE FUNCTION public.process_payment_callback(
  _order_number text,
  _transaction_id text,
  _status text,
  _gateway text,
  _raw jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  ord public.orders%ROWTYPE;
  payload jsonb;
BEGIN
  SELECT * INTO ord FROM public.orders WHERE order_number = _order_number LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'order_not_found');
  END IF;
  payload := jsonb_build_object('gateway', _gateway, 'txn', _transaction_id, 'raw', COALESCE(_raw, '{}'::jsonb));
  IF _status = 'paid' THEN
    RETURN public.mark_order_paid(ord.id, _transaction_id, payload);
  ELSE
    RETURN public.mark_order_failed(ord.id, 'gateway:' || _gateway, payload);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.process_payment_callback(text, text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_payment_callback(text, text, text, text, jsonb) TO anon, authenticated;

-- 3) Payment event logger (append-only)
CREATE OR REPLACE FUNCTION public.log_payment_event(_entry jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.payment_logs(
    gateway, event_type, order_id, order_number, payment_intent_id, transaction_id,
    amount, currency, status, signature_valid, ip_address, user_agent,
    request_body, response_body, error_message
  ) VALUES (
    _entry->>'gateway', _entry->>'event_type',
    NULLIF(_entry->>'order_id','')::uuid, _entry->>'order_number',
    NULLIF(_entry->>'payment_intent_id','')::uuid, _entry->>'transaction_id',
    NULLIF(_entry->>'amount','')::numeric, _entry->>'currency', _entry->>'status',
    NULLIF(_entry->>'signature_valid','')::boolean, _entry->>'ip_address', _entry->>'user_agent',
    _entry->'request_body', _entry->'response_body', _entry->>'error_message'
  );
END; $$;

REVOKE ALL ON FUNCTION public.log_payment_event(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_payment_event(jsonb) TO anon, authenticated;

-- 4) Webhook event claim (returns true when already processed)
CREATE OR REPLACE FUNCTION public.claim_webhook_event(_gateway text, _event_id text, _order_id uuid DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  BEGIN
    INSERT INTO public.webhook_events(gateway, event_id, order_id) VALUES (_gateway, _event_id, _order_id);
  EXCEPTION WHEN unique_violation THEN
    RETURN true;
  END;
  RETURN false;
END; $$;

REVOKE ALL ON FUNCTION public.claim_webhook_event(text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_webhook_event(text, text, uuid) TO anon, authenticated;

-- 5) Audit log write
CREATE OR REPLACE FUNCTION public.insert_audit_log(_entry jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.audit_logs(
    actor_id, actor_email, action, entity_type, entity_id, metadata, ip_address, user_agent
  ) VALUES (
    NULLIF(_entry->>'actor_id','')::uuid, _entry->>'actor_email',
    _entry->>'action', _entry->>'entity_type', _entry->>'entity_id',
    COALESCE(_entry->'metadata', '{}'::jsonb),
    _entry->>'ip_address', _entry->>'user_agent'
  );
END; $$;

REVOKE ALL ON FUNCTION public.insert_audit_log(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.insert_audit_log(jsonb) TO anon, authenticated;

-- 6) Enqueue an email log row (queue). Public-callable because triggers fire from webhooks too.
CREATE OR REPLACE FUNCTION public.enqueue_email_log(_row jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_id uuid;
BEGIN
  INSERT INTO public.email_logs(
    template_key, recipient, subject, status, attempts, max_attempts,
    payload, rendered_html, provider
  ) VALUES (
    _row->>'template_key', _row->>'recipient', COALESCE(_row->>'subject',''),
    COALESCE(_row->>'status','queued'),
    COALESCE(NULLIF(_row->>'attempts','')::int, 0),
    COALESCE(NULLIF(_row->>'max_attempts','')::int, 3),
    COALESCE(_row->'payload','{}'::jsonb),
    _row->>'rendered_html', _row->>'provider'
  ) RETURNING id INTO new_id;
  RETURN new_id;
END; $$;

REVOKE ALL ON FUNCTION public.enqueue_email_log(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enqueue_email_log(jsonb) TO anon, authenticated;

-- 7) Newsletter subscribe (idempotent)
CREATE OR REPLACE FUNCTION public.subscribe_newsletter(_email text, _name text DEFAULT NULL, _source text DEFAULT 'homepage')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE existing RECORD;
BEGIN
  _email := lower(TRIM(_email));
  IF _email IS NULL OR _email = '' THEN RETURN jsonb_build_object('ok', false, 'reason','invalid'); END IF;
  SELECT id, status INTO existing FROM public.newsletter_subscribers WHERE email = _email::citext LIMIT 1;
  IF FOUND THEN
    IF existing.status <> 'subscribed' THEN
      UPDATE public.newsletter_subscribers SET status='subscribed', unsubscribed_at=NULL WHERE id = existing.id;
    END IF;
    RETURN jsonb_build_object('ok', true, 'already', true);
  END IF;
  INSERT INTO public.newsletter_subscribers(email, name, source)
    VALUES (_email::citext, _name, COALESCE(_source,'homepage'));
  RETURN jsonb_build_object('ok', true, 'already', false);
END; $$;

REVOKE ALL ON FUNCTION public.subscribe_newsletter(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.subscribe_newsletter(text, text, text) TO anon, authenticated;
