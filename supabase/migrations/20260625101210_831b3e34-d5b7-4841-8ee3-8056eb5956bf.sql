
-- Drop overly permissive policies on payments bucket
DROP POLICY IF EXISTS payments_public_read ON storage.objects;
DROP POLICY IF EXISTS payments_anyone_upload ON storage.objects;

-- Upload: anyone may upload but only under 'submissions/' prefix
CREATE POLICY payments_submissions_upload ON storage.objects
  FOR INSERT TO public
  WITH CHECK (bucket_id = 'payments' AND name LIKE 'submissions/%');

-- Read: admins only (owners get access via short-lived signed URLs from server)
CREATE POLICY payments_admin_read ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'payments' AND has_role(auth.uid(), 'admin'));
