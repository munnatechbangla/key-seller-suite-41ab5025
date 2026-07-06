
-- Add column linking a fulfillment to a subscription assignment
ALTER TABLE public.order_fulfillments
  ADD COLUMN IF NOT EXISTS subscription_assignment_id uuid REFERENCES public.subscription_assignments(id) ON DELETE SET NULL;

-- ============================================================
-- assign_subscription: core auto-assignment
-- ============================================================
CREATE OR REPLACE FUNCTION public.assign_subscription(
  _order_id uuid,
  _order_item_id uuid,
  _product_id uuid
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  ord public.orders%ROWTYPE;
  prod public.products%ROWTYPE;
  mode public.subscription_mode;
  acct public.subscription_accounts%ROWTYPE;
  prof public.subscription_profiles%ROWTYPE;
  new_assignment_id uuid;
  existing uuid;
BEGIN
  -- Idempotency: if an active assignment already exists for this order_item, reuse it.
  SELECT id INTO existing FROM public.subscription_assignments
    WHERE order_item_id = _order_item_id AND status = 'active'
    ORDER BY assigned_at DESC LIMIT 1;
  IF existing IS NOT NULL THEN RETURN existing; END IF;

  SELECT * INTO ord  FROM public.orders   WHERE id = _order_id;
  SELECT * INTO prod FROM public.products WHERE id = _product_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  mode := COALESCE(prod.subscription_mode, 'email_password'::public.subscription_mode);

  IF mode IN ('shared_account','profile_based') THEN
    -- Find an available account with a free profile slot
    SELECT * INTO acct FROM public.subscription_accounts
      WHERE product_id = _product_id
        AND status IN ('available','assigned')
        AND used_profiles < maximum_profiles
      ORDER BY created_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED;
    IF NOT FOUND THEN RETURN NULL; END IF;

    -- Pick a free profile on that account
    SELECT * INTO prof FROM public.subscription_profiles
      WHERE subscription_account_id = acct.id AND status = 'available'
      ORDER BY slot_number NULLS LAST, created_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED;
    IF NOT FOUND THEN RETURN NULL; END IF;

    UPDATE public.subscription_profiles SET status = 'assigned' WHERE id = prof.id;
    UPDATE public.subscription_accounts
      SET used_profiles = used_profiles + 1,
          status = CASE WHEN used_profiles + 1 >= maximum_profiles THEN 'assigned'::public.subscription_account_status ELSE status END
      WHERE id = acct.id;

    INSERT INTO public.subscription_assignments(
      order_id, order_item_id, customer_id, email,
      subscription_account_id, profile_id, expires_at, status
    ) VALUES (
      _order_id, _order_item_id, ord.user_id, ord.email,
      acct.id, prof.id, acct.expiry_date, 'active'
    ) RETURNING id INTO new_assignment_id;

  ELSIF mode IN ('individual_account','email_password') THEN
    SELECT * INTO acct FROM public.subscription_accounts
      WHERE product_id = _product_id
        AND status = 'available'
      ORDER BY created_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED;
    IF NOT FOUND THEN RETURN NULL; END IF;

    UPDATE public.subscription_accounts
      SET status = 'assigned',
          used_profiles = GREATEST(used_profiles, 1)
      WHERE id = acct.id;

    INSERT INTO public.subscription_assignments(
      order_id, order_item_id, customer_id, email,
      subscription_account_id, profile_id, expires_at, status
    ) VALUES (
      _order_id, _order_item_id, ord.user_id, ord.email,
      acct.id, NULL, acct.expiry_date, 'active'
    ) RETURNING id INTO new_assignment_id;

  ELSE
    -- activation_code / custom: foundation only, no auto assignment yet
    RETURN NULL;
  END IF;

  INSERT INTO public.subscription_logs(
    subscription_account_id, profile_id, assignment_id, action, message, metadata
  ) VALUES (
    acct.id, prof.id, new_assignment_id, 'assigned',
    'Auto-assigned from paid order', jsonb_build_object('order_id', _order_id, 'mode', mode)
  );

  RETURN new_assignment_id;
END $$;

REVOKE EXECUTE ON FUNCTION public.assign_subscription(uuid,uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.assign_subscription(uuid,uuid,uuid) TO service_role;

-- ============================================================
-- Extend evaluate_fulfillment: subscription path first, otherwise existing logic
-- ============================================================
CREATE OR REPLACE FUNCTION public.evaluate_fulfillment(_fulfillment_id uuid)
RETURNS public.fulfillment_status
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  f public.order_fulfillments%ROWTYPE;
  prod RECORD;
  assign RECORD;
  sub_assignment_id uuid;
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

  -- ========= SUBSCRIPTION PATH (new) =========
  IF prod.delivery_type = 'subscription'::public.product_delivery_type THEN
    d_type := 'subscription';
    sub_assignment_id := public.assign_subscription(f.order_id, f.order_item_id, f.product_id);
    IF sub_assignment_id IS NOT NULL THEN
      new_status := 'delivered';
      UPDATE public.order_fulfillments
        SET fulfillment_status = new_status,
            delivery_type = d_type,
            subscription_assignment_id = sub_assignment_id,
            completed_at = now()
        WHERE id = _fulfillment_id;
      PERFORM public.log_fulfillment_event(_fulfillment_id, 'subscription_assigned',
        'Subscription account assigned automatically', NULL,
        jsonb_build_object('assignment_id', sub_assignment_id));
      PERFORM public.log_fulfillment_event(_fulfillment_id, 'delivery_completed', NULL, NULL, '{}'::jsonb);
      RETURN new_status;
    END IF;

    -- No inventory available → manual review, do not fail the order
    new_status := 'manual_review';
    UPDATE public.order_fulfillments
      SET fulfillment_status = new_status,
          delivery_type = d_type,
          failure_reason = 'No available subscription account'
      WHERE id = _fulfillment_id;
    PERFORM public.log_fulfillment_event(_fulfillment_id, 'manual_review_required',
      'No available subscription account — manual assignment required', NULL, '{}'::jsonb);
    RETURN new_status;
  END IF;

  -- ========= EXISTING LEGACY PATH (unchanged) =========
  SELECT EXISTS (SELECT 1 FROM public.inventory_pools WHERE product_id = f.product_id AND is_active) INTO has_pool;
  SELECT EXISTS (SELECT 1 FROM public.product_downloads WHERE product_id = f.product_id) INTO has_download;

  IF has_pool THEN d_type := 'inventory';
  ELSIF has_download THEN d_type := 'download';
  ELSE d_type := 'manual';
  END IF;

  IF has_pool THEN
    SELECT * INTO assign
      FROM public.inventory_assignments
      WHERE order_item_id = f.order_item_id AND status = 'active'
      ORDER BY created_at DESC LIMIT 1;
    IF FOUND THEN
      new_status := 'delivered';
      UPDATE public.order_fulfillments
        SET fulfillment_status = new_status, delivery_type = d_type,
            inventory_assignment_id = assign.id, completed_at = now()
        WHERE id = _fulfillment_id;
      PERFORM public.log_fulfillment_event(_fulfillment_id, 'inventory_assigned',
        'Inventory item linked automatically', NULL, jsonb_build_object('assignment_id', assign.id));
      PERFORM public.log_fulfillment_event(_fulfillment_id, 'delivery_completed', NULL, NULL, '{}'::jsonb);
      RETURN new_status;
    END IF;

    new_status := 'waiting_inventory';
    UPDATE public.order_fulfillments
      SET fulfillment_status = new_status, delivery_type = d_type,
          failure_reason = 'No inventory available'
      WHERE id = _fulfillment_id;
    PERFORM public.log_fulfillment_event(_fulfillment_id, 'waiting_inventory', 'No available inventory item', NULL, '{}'::jsonb);
    RETURN new_status;
  END IF;

  IF has_download THEN
    new_status := 'delivered';
    UPDATE public.order_fulfillments
      SET fulfillment_status = new_status, delivery_type = d_type, completed_at = now()
      WHERE id = _fulfillment_id;
    PERFORM public.log_fulfillment_event(_fulfillment_id, 'download_prepared', 'Download links available', NULL, '{}'::jsonb);
    PERFORM public.log_fulfillment_event(_fulfillment_id, 'delivery_completed', NULL, NULL, '{}'::jsonb);
    RETURN new_status;
  END IF;

  new_status := 'manual_review';
  UPDATE public.order_fulfillments
    SET fulfillment_status = new_status, delivery_type = d_type
    WHERE id = _fulfillment_id;
  PERFORM public.log_fulfillment_event(_fulfillment_id, 'manual_review_required',
    'Product has no automated delivery configuration', NULL, '{}'::jsonb);
  RETURN new_status;
EXCEPTION WHEN OTHERS THEN
  UPDATE public.order_fulfillments
    SET fulfillment_status = 'failed', failure_reason = SQLERRM
    WHERE id = _fulfillment_id;
  PERFORM public.log_fulfillment_event(_fulfillment_id, 'retry_failed', SQLERRM, NULL, '{}'::jsonb);
  RETURN 'failed';
END $$;

REVOKE EXECUTE ON FUNCTION public.evaluate_fulfillment(uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.evaluate_fulfillment(uuid) TO service_role;

-- ============================================================
-- Customer-facing read: subscription delivery for an order
-- (returns encrypted password; server function decrypts after auth)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_order_subscription_delivery(_order_id uuid, _email text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  ord public.orders%ROWTYPE;
  rows jsonb;
BEGIN
  SELECT * INTO ord FROM public.orders WHERE id = _order_id;
  IF NOT FOUND THEN RETURN '[]'::jsonb; END IF;

  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
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

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'assignment_id', sa.id,
    'order_item_id', sa.order_item_id,
    'status', sa.status,
    'assigned_at', sa.assigned_at,
    'expires_at', sa.expires_at,
    'renewal_required', sa.renewal_required,
    'account_email', acc.account_email,
    'account_password_encrypted', acc.account_password_encrypted,
    'provider', acc.provider,
    'two_factor_enabled', acc.two_factor_enabled,
    'subscription_mode', p.subscription_mode,
    'product_id', oi.product_id,
    'product_slug', oi.product_slug,
    'product_name', oi.product_name,
    'profile_name', pr.profile_name,
    'profile_pin', pr.pin_code,
    'profile_avatar', pr.avatar,
    'profile_slot', pr.slot_number
  ) ORDER BY sa.assigned_at), '[]'::jsonb) INTO rows
  FROM public.subscription_assignments sa
  LEFT JOIN public.subscription_accounts acc ON acc.id = sa.subscription_account_id
  LEFT JOIN public.subscription_profiles pr ON pr.id = sa.profile_id
  LEFT JOIN public.order_items oi ON oi.id = sa.order_item_id
  LEFT JOIN public.products p ON p.id = oi.product_id
  WHERE sa.order_id = _order_id;

  RETURN rows;
END $$;

REVOKE EXECUTE ON FUNCTION public.get_order_subscription_delivery(uuid,text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_order_subscription_delivery(uuid,text) TO authenticated, service_role;

-- ============================================================
-- Admin: release / replace / expire / note
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_release_subscription_assignment(_assignment_id uuid, _reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE a public.subscription_assignments%ROWTYPE;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT * INTO a FROM public.subscription_assignments WHERE id = _assignment_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;

  UPDATE public.subscription_assignments SET status = 'cancelled' WHERE id = _assignment_id;

  IF a.profile_id IS NOT NULL THEN
    UPDATE public.subscription_profiles SET status = 'available' WHERE id = a.profile_id;
  END IF;
  IF a.subscription_account_id IS NOT NULL THEN
    UPDATE public.subscription_accounts
      SET used_profiles = GREATEST(0, used_profiles - 1),
          status = CASE WHEN status = 'assigned' THEN 'available'::public.subscription_account_status ELSE status END
      WHERE id = a.subscription_account_id;
  END IF;

  INSERT INTO public.subscription_logs(subscription_account_id, profile_id, assignment_id, action, actor_id, message)
  VALUES (a.subscription_account_id, a.profile_id, a.id, 'cancelled', auth.uid(), _reason);

  RETURN jsonb_build_object('ok', true);
END $$;

REVOKE EXECUTE ON FUNCTION public.admin_release_subscription_assignment(uuid,text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.admin_release_subscription_assignment(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_replace_subscription_assignment(_assignment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  a public.subscription_assignments%ROWTYPE;
  oi public.order_items%ROWTYPE;
  new_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT * INTO a FROM public.subscription_assignments WHERE id = _assignment_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  SELECT * INTO oi FROM public.order_items WHERE id = a.order_item_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'order_item_not_found'; END IF;

  -- Release old
  UPDATE public.subscription_assignments SET status = 'replaced' WHERE id = _assignment_id;
  IF a.profile_id IS NOT NULL THEN
    UPDATE public.subscription_profiles SET status = 'blocked' WHERE id = a.profile_id;
  END IF;
  IF a.subscription_account_id IS NOT NULL THEN
    UPDATE public.subscription_accounts
      SET status = 'maintenance',
          used_profiles = GREATEST(0, used_profiles - 1)
      WHERE id = a.subscription_account_id;
  END IF;

  INSERT INTO public.subscription_logs(subscription_account_id, profile_id, assignment_id, action, actor_id, message)
  VALUES (a.subscription_account_id, a.profile_id, a.id, 'replaced', auth.uid(), 'Replaced by admin');

  -- Assign a new one
  new_id := public.assign_subscription(a.order_id, a.order_item_id, oi.product_id);
  IF new_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_available_subscription');
  END IF;

  -- Point fulfillment to the new assignment if any
  UPDATE public.order_fulfillments
    SET subscription_assignment_id = new_id,
        fulfillment_status = 'delivered',
        completed_at = now()
    WHERE order_item_id = a.order_item_id;

  RETURN jsonb_build_object('ok', true, 'assignment_id', new_id);
END $$;

REVOKE EXECUTE ON FUNCTION public.admin_replace_subscription_assignment(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.admin_replace_subscription_assignment(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_mark_subscription_expired(_assignment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE a public.subscription_assignments%ROWTYPE;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT * INTO a FROM public.subscription_assignments WHERE id = _assignment_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  UPDATE public.subscription_assignments SET status = 'expired' WHERE id = _assignment_id;
  IF a.subscription_account_id IS NOT NULL THEN
    UPDATE public.subscription_accounts SET status = 'expired' WHERE id = a.subscription_account_id;
  END IF;
  INSERT INTO public.subscription_logs(subscription_account_id, profile_id, assignment_id, action, actor_id)
  VALUES (a.subscription_account_id, a.profile_id, a.id, 'expired', auth.uid());
  RETURN jsonb_build_object('ok', true);
END $$;

REVOKE EXECUTE ON FUNCTION public.admin_mark_subscription_expired(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.admin_mark_subscription_expired(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_add_subscription_note(_assignment_id uuid, _note text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE a public.subscription_assignments%ROWTYPE;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT * INTO a FROM public.subscription_assignments WHERE id = _assignment_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  INSERT INTO public.subscription_logs(subscription_account_id, profile_id, assignment_id, action, actor_id, message)
  VALUES (a.subscription_account_id, a.profile_id, a.id, 'note', auth.uid(), _note);
  RETURN jsonb_build_object('ok', true);
END $$;

REVOKE EXECUTE ON FUNCTION public.admin_add_subscription_note(uuid,text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.admin_add_subscription_note(uuid,text) TO authenticated;
