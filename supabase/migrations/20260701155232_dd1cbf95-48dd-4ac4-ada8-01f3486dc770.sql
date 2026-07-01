
CREATE OR REPLACE FUNCTION public.get_latest_payment_intent(_order_id uuid, _gateway text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE row RECORD;
BEGIN
  SELECT id, mode, status INTO row FROM public.payment_intents
    WHERE order_id = _order_id AND gateway = _gateway
    ORDER BY created_at DESC LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN to_jsonb(row);
END; $$;

REVOKE ALL ON FUNCTION public.get_latest_payment_intent(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_latest_payment_intent(uuid, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.update_payment_intent_status(
  _id uuid, _status text, _gateway_payment_id text DEFAULT NULL, _response jsonb DEFAULT '{}'::jsonb
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.payment_intents
    SET status = _status,
        gateway_payment_id = COALESCE(_gateway_payment_id, gateway_payment_id),
        response_payload = COALESCE(_response, response_payload)
    WHERE id = _id;
END; $$;

REVOKE ALL ON FUNCTION public.update_payment_intent_status(uuid, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_payment_intent_status(uuid, text, text, jsonb) TO anon, authenticated;

-- Look up basic order info by number (public data for webhook processing)
CREATE OR REPLACE FUNCTION public.get_order_basic_by_number(_order_number text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE row RECORD;
BEGIN
  SELECT id, order_number, total, currency, status INTO row
    FROM public.orders WHERE order_number = _order_number LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN to_jsonb(row);
END; $$;

REVOKE ALL ON FUNCTION public.get_order_basic_by_number(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_order_basic_by_number(text) TO anon, authenticated;
