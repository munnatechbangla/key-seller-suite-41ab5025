
-- 1. Coupons: drop the publicly-readable policy. Admin policy already exists for admin reads.
DROP POLICY IF EXISTS "coupons_read_active" ON public.coupons;

-- 2. user_roles: explicit restrictive policy preventing non-admin inserts/updates/deletes.
CREATE POLICY "Block non-admin role writes" ON public.user_roles
  AS RESTRICTIVE
  FOR ALL
  TO authenticated, anon
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 3. manual_payment_submissions: tighten WITH CHECK so signed-in users cannot impersonate others.
DROP POLICY IF EXISTS "Anyone can submit proof of payment" ON public.manual_payment_submissions;
CREATE POLICY "Submit proof of payment" ON public.manual_payment_submissions
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (
    user_id IS NULL
    OR (auth.uid() IS NOT NULL AND user_id = auth.uid())
  );

-- 4. Storage: tighten the payments-submissions upload policy.
DROP POLICY IF EXISTS "payments_submissions_upload" ON storage.objects;
CREATE POLICY "payments_submissions_upload" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'payments'
    AND name LIKE 'submissions/' || auth.uid()::text || '/%'
  );

-- 5. Revoke EXECUTE on internal SECURITY DEFINER functions from anon and authenticated.
REVOKE EXECUTE ON FUNCTION public.apply_coupon_usage(uuid, uuid, uuid, text, numeric, numeric) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.assign_licenses_for_order(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_order_paid(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_order_failed(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recalc_product_rating(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_recalc_rating_fn() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

-- Ensure service_role retains access (default, but explicit for clarity).
GRANT EXECUTE ON FUNCTION public.apply_coupon_usage(uuid, uuid, uuid, text, numeric, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.assign_licenses_for_order(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_order_paid(uuid, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_order_failed(uuid, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.recalc_product_rating(uuid) TO service_role;
