
CREATE POLICY "payments_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'payments');

CREATE POLICY "payments_anyone_upload"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'payments');

CREATE POLICY "payments_admin_update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'payments' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'payments' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "payments_admin_delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'payments' AND public.has_role(auth.uid(), 'admin'));
