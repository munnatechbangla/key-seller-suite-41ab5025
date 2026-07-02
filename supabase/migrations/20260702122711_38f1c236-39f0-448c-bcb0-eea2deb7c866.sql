-- Replace the single authenticated-only upload policy with two branches:
-- 1) authenticated users under their own uid folder
-- 2) guest (anon) checkout under submissions/guest/
DROP POLICY IF EXISTS "payments_submissions_upload" ON storage.objects;

CREATE POLICY "payments_submissions_upload_auth" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'payments'
    AND name LIKE ('submissions/' || auth.uid()::text || '/%')
  );

CREATE POLICY "payments_submissions_upload_guest" ON storage.objects
  FOR INSERT
  TO anon
  WITH CHECK (
    bucket_id = 'payments'
    AND name LIKE 'submissions/guest/%'
  );
