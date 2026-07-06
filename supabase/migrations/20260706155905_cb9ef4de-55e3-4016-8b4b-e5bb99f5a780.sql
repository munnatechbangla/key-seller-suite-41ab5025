
-- ============================================================
-- Order Fulfillment Engine
-- ============================================================

-- Status enum
DO $$ BEGIN
  CREATE TYPE public.fulfillment_status AS ENUM (
    'pending','processing','waiting_inventory','manual_review',
    'delivered','failed','cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Main fulfillment table
CREATE TABLE IF NOT EXISTS public.order_fulfillments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  order_item_id uuid REFERENCES public.order_items(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id),
  variation_id uuid,
  fulfillment_status public.fulfillment_status NOT NULL DEFAULT 'pending',
  delivery_type text,
  inventory_assignment_id uuid REFERENCES public.inventory_assignments(id),
  attempt_count int NOT NULL DEFAULT 0,
  started_at timestamptz,
  completed_at timestamptz,
  last_retry_at timestamptz,
  failure_reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id, order_item_id)
);

GRANT SELECT ON public.order_fulfillments TO authenticated, anon;
GRANT ALL ON public.order_fulfillments TO service_role;

ALTER TABLE public.order_fulfillments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers view own fulfillments"
  ON public.order_fulfillments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_fulfillments.order_id
        AND o.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins manage fulfillments"
  ON public.order_fulfillments FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX IF NOT EXISTS idx_order_fulfillments_order   ON public.order_fulfillments(order_id);
CREATE INDEX IF NOT EXISTS idx_order_fulfillments_status  ON public.order_fulfillments(fulfillment_status);
CREATE INDEX IF NOT EXISTS idx_order_fulfillments_product ON public.order_fulfillments(product_id);

CREATE TRIGGER trg_order_fulfillments_updated_at
  BEFORE UPDATE ON public.order_fulfillments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Timeline / logs
CREATE TABLE IF NOT EXISTS public.fulfillment_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fulfillment_id uuid NOT NULL REFERENCES public.order_fulfillments(id) ON DELETE CASCADE,
  event text NOT NULL,
  message text,
  performed_by uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.fulfillment_logs TO authenticated, anon;
GRANT ALL ON public.fulfillment_logs TO service_role;

ALTER TABLE public.fulfillment_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers view own fulfillment logs"
  ON public.fulfillment_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.order_fulfillments f
      JOIN public.orders o ON o.id = f.order_id
      WHERE f.id = fulfillment_logs.fulfillment_id
        AND o.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins manage fulfillment logs"
  ON public.fulfillment_logs FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX IF NOT EXISTS idx_fulfillment_logs_fulfillment ON public.fulfillment_logs(fulfillment_id, created_at DESC);

-- ============================================================
-- Internal helper: append log line
-- ============================================================
CREATE OR REPLACE FUNCTION public.log_fulfillment_event(
  _fulfillment_id uuid, _event text, _message text DEFAULT NULL,
  _performed_by uuid DEFAULT NULL, _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.fulfillment_logs(fulfillment_id, event, message, performed_by, metadata)
  VALUES (_fulfillment_id, _event, _message, _performed_by, COALESCE(_metadata, '{}'::jsonb));
END $$;

REVOKE EXECUTE ON FUNCTION public.log_fulfillment_event(uuid,text,text,uuid,jsonb) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.log_fulfillment_event(uuid,text,text,uuid,jsonb) TO service_role;

-- ============================================================
-- Core engine: evaluate one fulfillment row and set status
-- ============================================================
CREATE OR REPLACE FUNCTION public.evaluate_fulfillment(_fulfillment_id uuid)
RETURNS public.fulfillment_status
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  f public.order_fulfillments%ROWTYPE;
  prod RECORD;
  assign RECORD;
  has_pool boolean := false;
  has_download boolean := false;
  new_status public.fulfillment_status;
  d_type text;
BEGIN
  SELECT * INTO f FROM public.order_fulfillments WHERE id = _fulfillment_id FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;

  IF f.fulfillment_status IN ('delivered','cancelled') THEN
    RETURN f.fulfillment_status;
  END IF;

  UPDATE public.order_fulfillments
    SET fulfillment_status = 'processing',
        started_at = COALESCE(started_at, now()),
        attempt_count = attempt_count + 1,
        last_retry_at = CASE WHEN attempt_count > 0 THEN now() ELSE last_retry_at END,
        failure_reason = NULL
    WHERE id = _fulfillment_id;

  SELECT * INTO prod FROM public.products WHERE id = f.product_id;

  SELECT EXISTS (SELECT 1 FROM public.inventory_pools WHERE product_id = f.product_id AND is_active) INTO has_pool;
  SELECT EXISTS (SELECT 1 FROM public.product_downloads WHERE product_id = f.product_id) INTO has_download;

  -- Delivery type detection
  IF has_pool THEN d_type := 'inventory';
  ELSIF has_download THEN d_type := 'download';
  ELSE d_type := 'manual';
  END IF;

  -- Look for an inventory assignment matching this fulfillment's order_item
  IF has_pool THEN
    SELECT * INTO assign
      FROM public.inventory_assignments
      WHERE order_item_id = f.order_item_id
        AND status = 'active'
      ORDER BY created_at DESC LIMIT 1;

    IF FOUND THEN
      new_status := 'delivered';
      UPDATE public.order_fulfillments
        SET fulfillment_status = new_status,
            delivery_type = d_type,
            inventory_assignment_id = assign.id,
            completed_at = now()
        WHERE id = _fulfillment_id;
      PERFORM public.log_fulfillment_event(_fulfillment_id, 'inventory_assigned',
        'Inventory item linked automatically', NULL,
        jsonb_build_object('assignment_id', assign.id));
      PERFORM public.log_fulfillment_event(_fulfillment_id, 'delivery_completed', NULL, NULL, '{}'::jsonb);
      RETURN new_status;
    END IF;

    new_status := 'waiting_inventory';
    UPDATE public.order_fulfillments
      SET fulfillment_status = new_status,
          delivery_type = d_type,
          failure_reason = 'No inventory available'
      WHERE id = _fulfillment_id;
    PERFORM public.log_fulfillment_event(_fulfillment_id, 'waiting_inventory', 'No available inventory item', NULL, '{}'::jsonb);
    RETURN new_status;
  END IF;

  IF has_download THEN
    new_status := 'delivered';
    UPDATE public.order_fulfillments
      SET fulfillment_status = new_status,
          delivery_type = d_type,
          completed_at = now()
      WHERE id = _fulfillment_id;
    PERFORM public.log_fulfillment_event(_fulfillment_id, 'download_prepared', 'Download links available', NULL, '{}'::jsonb);
    PERFORM public.log_fulfillment_event(_fulfillment_id, 'delivery_completed', NULL, NULL, '{}'::jsonb);
    RETURN new_status;
  END IF;

  new_status := 'manual_review';
  UPDATE public.order_fulfillments
    SET fulfillment_status = new_status,
        delivery_type = d_type
    WHERE id = _fulfillment_id;
  PERFORM public.log_fulfillment_event(_fulfillment_id, 'manual_review_required',
    'Product has no automated delivery configuration', NULL, '{}'::jsonb);
  RETURN new_status;
EXCEPTION WHEN OTHERS THEN
  UPDATE public.order_fulfillments
    SET fulfillment_status = 'failed',
        failure_reason = SQLERRM
    WHERE id = _fulfillment_id;
  PERFORM public.log_fulfillment_event(_fulfillment_id, 'retry_failed', SQLERRM, NULL, '{}'::jsonb);
  RETURN 'failed';
END $$;

REVOKE EXECUTE ON FUNCTION public.evaluate_fulfillment(uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.evaluate_fulfillment(uuid) TO service_role;

-- ============================================================
-- Start fulfillment for an entire order (idempotent)
-- ============================================================
CREATE OR REPLACE FUNCTION public.start_fulfillment_for_order(_order_id uuid)
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  it RECORD;
  fid uuid;
  created int := 0;
BEGIN
  FOR it IN SELECT * FROM public.order_items WHERE order_id = _order_id LOOP
    SELECT id INTO fid FROM public.order_fulfillments
      WHERE order_id = _order_id AND order_item_id = it.id;

    IF fid IS NULL THEN
      INSERT INTO public.order_fulfillments(order_id, order_item_id, product_id, fulfillment_status)
      VALUES (_order_id, it.id, it.product_id, 'pending')
      RETURNING id INTO fid;
      created := created + 1;
      PERFORM public.log_fulfillment_event(fid, 'payment_received', 'Payment confirmed', NULL, '{}'::jsonb);
      PERFORM public.log_fulfillment_event(fid, 'fulfillment_started', NULL, NULL, '{}'::jsonb);
    END IF;

    PERFORM public.evaluate_fulfillment(fid);
  END LOOP;
  RETURN created;
END $$;

REVOKE EXECUTE ON FUNCTION public.start_fulfillment_for_order(uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.start_fulfillment_for_order(uuid) TO service_role;

-- ============================================================
-- Admin actions
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_retry_fulfillment(_fulfillment_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_status public.fulfillment_status; BEGIN
  IF NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  PERFORM public.log_fulfillment_event(_fulfillment_id, 'retry_started', 'Admin retry', auth.uid(), '{}'::jsonb);
  SELECT public.evaluate_fulfillment(_fulfillment_id) INTO new_status;
  RETURN jsonb_build_object('ok', true, 'status', new_status);
END $$;

CREATE OR REPLACE FUNCTION public.admin_cancel_fulfillment(_fulfillment_id uuid, _reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  UPDATE public.order_fulfillments
    SET fulfillment_status = 'cancelled', failure_reason = COALESCE(_reason, failure_reason), completed_at = now()
    WHERE id = _fulfillment_id;
  PERFORM public.log_fulfillment_event(_fulfillment_id, 'fulfillment_cancelled', _reason, auth.uid(), '{}'::jsonb);
  RETURN jsonb_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION public.admin_restart_fulfillment(_fulfillment_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_status public.fulfillment_status; BEGIN
  IF NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  UPDATE public.order_fulfillments
    SET fulfillment_status = 'pending', completed_at = NULL, failure_reason = NULL
    WHERE id = _fulfillment_id;
  PERFORM public.log_fulfillment_event(_fulfillment_id, 'fulfillment_restarted', 'Admin restart', auth.uid(), '{}'::jsonb);
  SELECT public.evaluate_fulfillment(_fulfillment_id) INTO new_status;
  RETURN jsonb_build_object('ok', true, 'status', new_status);
END $$;

REVOKE EXECUTE ON FUNCTION public.admin_retry_fulfillment(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_cancel_fulfillment(uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_restart_fulfillment(uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.admin_retry_fulfillment(uuid) TO authenticated, service_role;
GRANT  EXECUTE ON FUNCTION public.admin_cancel_fulfillment(uuid,text) TO authenticated, service_role;
GRANT  EXECUTE ON FUNCTION public.admin_restart_fulfillment(uuid) TO authenticated, service_role;

-- ============================================================
-- Readers
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_order_fulfillments(_order_id uuid, _email text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE ord public.orders%ROWTYPE; rows jsonb; BEGIN
  SELECT * INTO ord FROM public.orders WHERE id = _order_id;
  IF NOT FOUND THEN RETURN '[]'::jsonb; END IF;

  IF NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN
    IF ord.user_id IS NOT NULL AND auth.uid() IS DISTINCT FROM ord.user_id THEN
      IF _email IS NULL OR ord.email IS NULL OR lower(_email) <> lower(ord.email) THEN
        RAISE EXCEPTION 'Forbidden';
      END IF;
    END IF;
    IF ord.user_id IS NULL AND _email IS NOT NULL AND ord.email IS NOT NULL
       AND lower(_email) <> lower(ord.email) THEN
      RAISE EXCEPTION 'Forbidden';
    END IF;
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.created_at), '[]'::jsonb) INTO rows
  FROM (
    SELECT f.*, p.title AS product_title, p.slug AS product_slug
    FROM public.order_fulfillments f
    LEFT JOIN public.products p ON p.id = f.product_id
    WHERE f.order_id = _order_id
  ) t;
  RETURN rows;
END $$;

CREATE OR REPLACE FUNCTION public.get_fulfillment_timeline(_fulfillment_id uuid, _email text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE ord_id uuid; ord public.orders%ROWTYPE; rows jsonb; BEGIN
  SELECT order_id INTO ord_id FROM public.order_fulfillments WHERE id = _fulfillment_id;
  IF ord_id IS NULL THEN RETURN '[]'::jsonb; END IF;
  SELECT * INTO ord FROM public.orders WHERE id = ord_id;

  IF NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN
    IF ord.user_id IS NOT NULL AND auth.uid() IS DISTINCT FROM ord.user_id THEN
      IF _email IS NULL OR ord.email IS NULL OR lower(_email) <> lower(ord.email) THEN
        RAISE EXCEPTION 'Forbidden';
      END IF;
    END IF;
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(l) ORDER BY l.created_at), '[]'::jsonb) INTO rows
  FROM public.fulfillment_logs l WHERE l.fulfillment_id = _fulfillment_id;
  RETURN rows;
END $$;

REVOKE EXECUTE ON FUNCTION public.get_order_fulfillments(uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_fulfillment_timeline(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_order_fulfillments(uuid,text) TO anon, authenticated, service_role;
GRANT  EXECUTE ON FUNCTION public.get_fulfillment_timeline(uuid,text) TO anon, authenticated, service_role;

-- ============================================================
-- Hook into mark_order_paid (wrap existing logic, do not modify prior behavior)
-- ============================================================
CREATE OR REPLACE FUNCTION public.mark_order_paid(_order_id uuid, _transaction_id text, _gateway_response jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  ord RECORD;
  pay RECORD;
  assigned INT := 0;
  inv_assigned INT := 0;
  fulfil INT := 0;
BEGIN
  SELECT * INTO ord FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'order_not_found'); END IF;

  IF ord.status = 'paid' THEN
    RETURN jsonb_build_object('ok', true, 'already', true, 'order_id', _order_id);
  END IF;

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
  SELECT public.assign_inventory_for_order(_order_id) INTO inv_assigned;
  SELECT public.start_fulfillment_for_order(_order_id) INTO fulfil;

  RETURN jsonb_build_object(
    'ok', true, 'order_id', _order_id,
    'licenses_assigned', assigned,
    'inventory_assigned', inv_assigned,
    'fulfillments_created', fulfil
  );
END;
$function$;
