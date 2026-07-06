
-- Media assets catalog
CREATE TABLE IF NOT EXISTS public.media_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_path text NOT NULL UNIQUE,
  filename text NOT NULL,
  original_filename text,
  folder text NOT NULL DEFAULT 'general',
  mime_type text NOT NULL,
  file_size bigint NOT NULL DEFAULT 0,
  width int,
  height int,
  public_url text,
  uploader_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS media_assets_folder_idx ON public.media_assets(folder);
CREATE INDEX IF NOT EXISTS media_assets_created_idx ON public.media_assets(created_at DESC);
CREATE INDEX IF NOT EXISTS media_assets_filename_idx ON public.media_assets(filename);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.media_assets TO authenticated;
GRANT ALL ON public.media_assets TO service_role;

ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage media_assets"
  ON public.media_assets FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER media_assets_set_updated_at
  BEFORE UPDATE ON public.media_assets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Asset usage tracking
CREATE TABLE IF NOT EXISTS public.media_asset_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES public.media_assets(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  field text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (asset_id, entity_type, entity_id, field)
);

CREATE INDEX IF NOT EXISTS media_asset_usage_asset_idx ON public.media_asset_usage(asset_id);
CREATE INDEX IF NOT EXISTS media_asset_usage_entity_idx ON public.media_asset_usage(entity_type, entity_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.media_asset_usage TO authenticated;
GRANT ALL ON public.media_asset_usage TO service_role;

ALTER TABLE public.media_asset_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage media_asset_usage"
  ON public.media_asset_usage FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Storage policies for the private "media" bucket (admin-only)
CREATE POLICY "Admins read media bucket"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'media' AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins upload media bucket"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'media' AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins update media bucket"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'media' AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins delete media bucket"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'media' AND public.has_role(auth.uid(), 'admin'::public.app_role));

-- Helper: list assets with usage count
CREATE OR REPLACE FUNCTION public.admin_list_media_assets(
  _folder text DEFAULT NULL,
  _search text DEFAULT NULL,
  _mime_prefix text DEFAULT NULL,
  _limit int DEFAULT 60,
  _offset int DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  items jsonb;
  total int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.created_at DESC), '[]'::jsonb), COUNT(*) OVER ()
    INTO items, total
  FROM (
    SELECT a.*, (SELECT COUNT(*) FROM public.media_asset_usage u WHERE u.asset_id = a.id) AS usage_count
    FROM public.media_assets a
    WHERE (_folder IS NULL OR a.folder = _folder)
      AND (_search IS NULL OR a.filename ILIKE '%'||_search||'%' OR a.original_filename ILIKE '%'||_search||'%')
      AND (_mime_prefix IS NULL OR a.mime_type LIKE _mime_prefix || '%')
    ORDER BY a.created_at DESC
    LIMIT GREATEST(1, LEAST(_limit, 200)) OFFSET GREATEST(0, _offset)
  ) t;

  RETURN jsonb_build_object('items', COALESCE(items, '[]'::jsonb), 'total', COALESCE(total, 0));
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_asset_usage(_asset_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE rows jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  SELECT COALESCE(jsonb_agg(to_jsonb(u)), '[]'::jsonb) INTO rows
    FROM public.media_asset_usage u WHERE u.asset_id = _asset_id;
  RETURN rows;
END;
$$;
