DROP POLICY IF EXISTS "Public read media bucket" ON storage.objects;
CREATE POLICY "Public read media bucket"
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'media');