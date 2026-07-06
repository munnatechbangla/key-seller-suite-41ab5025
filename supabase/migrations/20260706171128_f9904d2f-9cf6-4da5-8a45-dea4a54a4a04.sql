
ALTER TABLE public.subscription_assignments
  ADD COLUMN IF NOT EXISTS activated_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS renewal_date timestamptz,
  ADD COLUMN IF NOT EXISTS remaining_days integer,
  ADD COLUMN IF NOT EXISTS auto_renew boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS renewal_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS suspended_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS replaced_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_notification_at timestamptz;

CREATE TABLE IF NOT EXISTS public.subscription_renewal_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.subscription_assignments(id) ON DELETE CASCADE,
  old_expiry timestamptz,
  new_expiry timestamptz,
  renewed_by uuid,
  renewal_type text NOT NULL CHECK (renewal_type IN ('manual','automatic','extension','replacement')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.subscription_renewal_history TO authenticated;
GRANT ALL ON public.subscription_renewal_history TO service_role;

ALTER TABLE public.subscription_renewal_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage renewal history"
  ON public.subscription_renewal_history FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Customers view own renewal history"
  ON public.subscription_renewal_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.subscription_assignments sa
      WHERE sa.id = assignment_id AND sa.customer_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_sub_renewal_history_assignment
  ON public.subscription_renewal_history(assignment_id);

CREATE OR REPLACE FUNCTION public.evaluate_subscription_status(_assignment_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  r public.subscription_assignments%ROWTYPE;
  v_days integer;
  v_status public.subscription_assignment_status;
BEGIN
  SELECT * INTO r FROM public.subscription_assignments WHERE id = _assignment_id;
  IF NOT FOUND THEN RETURN; END IF;
  IF r.status IN ('cancelled','replaced','suspended') THEN RETURN; END IF;
  IF r.expires_at IS NULL THEN
    v_days := NULL; v_status := 'active';
  ELSE
    v_days := GREATEST(0, CEIL(EXTRACT(EPOCH FROM (r.expires_at - now())) / 86400)::int);
    IF r.expires_at <= now() THEN v_status := 'expired';
    ELSIF v_days <= 30 THEN v_status := 'expiring_soon';
    ELSE v_status := 'active';
    END IF;
  END IF;
  UPDATE public.subscription_assignments
    SET remaining_days = v_days, status = v_status, updated_at = now()
    WHERE id = _assignment_id;
END; $$;

CREATE OR REPLACE FUNCTION public.evaluate_all_subscriptions()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE r record; cnt int := 0;
BEGIN
  FOR r IN SELECT id FROM public.subscription_assignments
           WHERE status NOT IN ('cancelled','replaced','suspended') LOOP
    PERFORM public.evaluate_subscription_status(r.id);
    cnt := cnt + 1;
  END LOOP;
  RETURN cnt;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_extend_subscription(
  _assignment_id uuid, _days integer, _notes text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE r public.subscription_assignments%ROWTYPE; new_exp timestamptz;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT * INTO r FROM public.subscription_assignments WHERE id = _assignment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Assignment not found'; END IF;
  new_exp := COALESCE(r.expires_at, now()) + make_interval(days => _days);
  UPDATE public.subscription_assignments
     SET expires_at = new_exp, renewal_date = new_exp, status = 'active', updated_at = now()
   WHERE id = _assignment_id;
  INSERT INTO public.subscription_renewal_history
    (assignment_id, old_expiry, new_expiry, renewed_by, renewal_type, notes)
    VALUES (_assignment_id, r.expires_at, new_exp, auth.uid(), 'extension', _notes);
  INSERT INTO public.subscription_logs (subscription_assignment_id, action, actor_id, metadata)
    VALUES (_assignment_id, 'extended', auth.uid(), jsonb_build_object('days', _days));
  PERFORM public.evaluate_subscription_status(_assignment_id);
  RETURN jsonb_build_object('ok', true, 'expires_at', new_exp);
END; $$;

CREATE OR REPLACE FUNCTION public.admin_renew_subscription(
  _assignment_id uuid, _days integer, _notes text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE r public.subscription_assignments%ROWTYPE; new_exp timestamptz;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT * INTO r FROM public.subscription_assignments WHERE id = _assignment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Assignment not found'; END IF;
  new_exp := GREATEST(COALESCE(r.expires_at, now()), now()) + make_interval(days => _days);
  UPDATE public.subscription_assignments
     SET expires_at = new_exp, renewal_date = new_exp,
         renewal_count = renewal_count + 1, status = 'renewed', updated_at = now()
   WHERE id = _assignment_id;
  INSERT INTO public.subscription_renewal_history
    (assignment_id, old_expiry, new_expiry, renewed_by, renewal_type, notes)
    VALUES (_assignment_id, r.expires_at, new_exp, auth.uid(), 'manual', _notes);
  INSERT INTO public.subscription_logs (subscription_assignment_id, action, actor_id, metadata)
    VALUES (_assignment_id, 'renewed', auth.uid(), jsonb_build_object('days', _days));
  PERFORM public.evaluate_subscription_status(_assignment_id);
  RETURN jsonb_build_object('ok', true, 'expires_at', new_exp);
END; $$;

CREATE OR REPLACE FUNCTION public.admin_suspend_subscription(
  _assignment_id uuid, _reason text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  UPDATE public.subscription_assignments
     SET status = 'suspended', suspended_at = now(), updated_at = now()
   WHERE id = _assignment_id;
  INSERT INTO public.subscription_logs (subscription_assignment_id, action, actor_id, metadata)
    VALUES (_assignment_id, 'suspended', auth.uid(), jsonb_build_object('reason', _reason));
  RETURN jsonb_build_object('ok', true);
END; $$;

CREATE OR REPLACE FUNCTION public.admin_resume_subscription(_assignment_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  UPDATE public.subscription_assignments
     SET status = 'active', suspended_at = NULL, updated_at = now()
   WHERE id = _assignment_id;
  INSERT INTO public.subscription_logs (subscription_assignment_id, action, actor_id)
    VALUES (_assignment_id, 'resumed', auth.uid());
  PERFORM public.evaluate_subscription_status(_assignment_id);
  RETURN jsonb_build_object('ok', true);
END; $$;

CREATE OR REPLACE FUNCTION public.admin_cancel_subscription(
  _assignment_id uuid, _reason text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  UPDATE public.subscription_assignments
     SET status = 'cancelled', cancelled_at = now(), updated_at = now()
   WHERE id = _assignment_id;
  INSERT INTO public.subscription_logs (subscription_assignment_id, action, actor_id, metadata)
    VALUES (_assignment_id, 'cancelled', auth.uid(), jsonb_build_object('reason', _reason));
  RETURN jsonb_build_object('ok', true);
END; $$;

CREATE OR REPLACE FUNCTION public.get_customer_subscriptions(_email text DEFAULT NULL)
RETURNS TABLE (
  assignment_id uuid, product_name text, provider text,
  status public.subscription_assignment_status,
  activated_at timestamptz, expires_at timestamptz, renewal_date timestamptz,
  remaining_days integer, renewal_count integer, auto_renew boolean, account_email text
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT sa.id, p.title, acc.provider, sa.status,
         sa.activated_at, sa.expires_at, sa.renewal_date,
         sa.remaining_days, sa.renewal_count, sa.auto_renew, acc.account_email
    FROM public.subscription_assignments sa
    LEFT JOIN public.subscription_accounts acc ON acc.id = sa.subscription_account_id
    LEFT JOIN public.order_items oi ON oi.id = sa.order_item_id
    LEFT JOIN public.products p ON p.id = oi.product_id
   WHERE (auth.uid() IS NOT NULL AND sa.customer_id = auth.uid())
      OR (_email IS NOT NULL AND lower(sa.email) = lower(_email))
   ORDER BY sa.assigned_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.get_subscription_renewal_history(_assignment_id uuid)
RETURNS SETOF public.subscription_renewal_history
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT h.*
    FROM public.subscription_renewal_history h
    JOIN public.subscription_assignments sa ON sa.id = h.assignment_id
   WHERE h.assignment_id = _assignment_id
     AND (public.has_role(auth.uid(), 'admin') OR sa.customer_id = auth.uid())
   ORDER BY h.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.evaluate_subscription_status(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.evaluate_all_subscriptions() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_extend_subscription(uuid,integer,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_renew_subscription(uuid,integer,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_suspend_subscription(uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_resume_subscription(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_cancel_subscription(uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_subscription_renewal_history(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.evaluate_subscription_status(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.evaluate_all_subscriptions() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_extend_subscription(uuid,integer,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_renew_subscription(uuid,integer,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_suspend_subscription(uuid,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_resume_subscription(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_cancel_subscription(uuid,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_customer_subscriptions(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_subscription_renewal_history(uuid) TO authenticated, service_role;
