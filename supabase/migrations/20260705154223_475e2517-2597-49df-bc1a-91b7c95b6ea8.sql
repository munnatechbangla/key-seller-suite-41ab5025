
-- 1) Remove always-true INSERT policy on newsletter_subscribers
DROP POLICY IF EXISTS "anyone can subscribe" ON public.newsletter_subscribers;
CREATE POLICY "anyone can subscribe"
  ON public.newsletter_subscribers
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (email IS NOT NULL AND length(trim(email::text)) > 3);

-- 2) Restrict site_settings public read to a whitelist of group_keys
DROP POLICY IF EXISTS "Public settings readable by all" ON public.site_settings;
CREATE POLICY "Public settings readable by all"
  ON public.site_settings
  FOR SELECT
  TO public
  USING (
    (
      is_public = true
      AND group_key IN ('site','seo','social','marketplace','homepage','legal','theme')
    )
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

-- 3) Tighten guest payment-proof uploads to require an order-number-shaped folder
DROP POLICY IF EXISTS "payments_submissions_upload_guest" ON storage.objects;
CREATE POLICY "payments_submissions_upload_guest"
  ON storage.objects
  FOR INSERT
  TO anon
  WITH CHECK (
    bucket_id = 'payments'
    AND name ~ '^submissions/guest/TH-[0-9]{8}-[A-Z0-9]{6}/'
  );

-- 4) Revoke EXECUTE on internal-only SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.admin_mark_order_paid(uuid, text, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_mark_order_failed(uuid, text, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.claim_webhook_event(text, text, uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_email_log(jsonb) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.insert_audit_log(jsonb) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_payment_event(jsonb) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_latest_payment_intent(uuid, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_payment_intent_status(uuid, text, text, jsonb) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.process_payment_callback(text, text, text, text, jsonb) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_order_basic_by_number(text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_coupon_usage_for_order(uuid, uuid, text) FROM anon, authenticated;
