
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS transaction_id text,
  ADD COLUMN IF NOT EXISTS gateway_response jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS payments_transaction_id_key
  ON public.payments(transaction_id) WHERE transaction_id IS NOT NULL;

ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'failed';

CREATE OR REPLACE FUNCTION public.mark_order_paid(
  _order_id uuid,
  _transaction_id text,
  _gateway_response jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ord RECORD;
  pay RECORD;
  assigned INT := 0;
BEGIN
  SELECT * INTO ord FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'order_not_found'); END IF;

  IF ord.status = 'paid' THEN
    RETURN jsonb_build_object('ok', true, 'already', true, 'order_id', _order_id);
  END IF;

  -- Idempotency on transaction id
  IF _transaction_id IS NOT NULL THEN
    PERFORM 1 FROM public.payments WHERE transaction_id = _transaction_id AND order_id <> _order_id;
    IF FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'duplicate_transaction'); END IF;
  END IF;

  SELECT * INTO pay FROM public.payments WHERE order_id = _order_id ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
  IF FOUND THEN
    UPDATE public.payments
      SET status = 'paid', paid_at = now(),
          transaction_id = COALESCE(_transaction_id, transaction_id),
          gateway_response = COALESCE(_gateway_response, gateway_response),
          provider_ref = COALESCE(_transaction_id, provider_ref)
      WHERE id = pay.id;
  ELSE
    INSERT INTO public.payments(order_id, amount, currency, method, status, paid_at, transaction_id, gateway_response, provider_ref)
    VALUES (_order_id, ord.total, ord.currency, COALESCE(ord.payment_method,'unknown'), 'paid', now(), _transaction_id, _gateway_response, _transaction_id);
  END IF;

  UPDATE public.orders SET status = 'paid' WHERE id = _order_id;

  SELECT public.assign_licenses_for_order(_order_id) INTO assigned;

  RETURN jsonb_build_object('ok', true, 'order_id', _order_id, 'licenses_assigned', assigned);
END;$$;

CREATE OR REPLACE FUNCTION public.mark_order_failed(
  _order_id uuid,
  _reason text DEFAULT NULL,
  _gateway_response jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE pay RECORD;
BEGIN
  UPDATE public.orders SET status = 'failed', notes = COALESCE(notes,'') || COALESCE(E'\n[failure] '||_reason,'') WHERE id = _order_id;
  SELECT * INTO pay FROM public.payments WHERE order_id = _order_id ORDER BY created_at DESC LIMIT 1;
  IF FOUND THEN
    UPDATE public.payments SET status='failed', gateway_response = COALESCE(_gateway_response, gateway_response) WHERE id = pay.id;
  END IF;
  RETURN jsonb_build_object('ok', true);
END;$$;

REVOKE ALL ON FUNCTION public.mark_order_paid(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_order_paid(uuid, text, jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.mark_order_failed(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_order_failed(uuid, text, jsonb) TO service_role;
