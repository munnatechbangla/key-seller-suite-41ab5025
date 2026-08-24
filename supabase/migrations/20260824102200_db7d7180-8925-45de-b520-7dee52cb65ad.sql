-- Part 1: Media Tables
CREATE TABLE IF NOT EXISTS public.media_assets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    filename text NOT NULL,
    storage_path text NOT NULL,
    mime_type text,
    size_bytes bigint,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.media_asset_usage (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id uuid REFERENCES public.media_assets(id) ON DELETE CASCADE,
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    field_name text,
    created_at timestamptz DEFAULT now()
);

-- Part 2: Media RPCs
CREATE OR REPLACE FUNCTION public.admin_list_media_assets()
RETURNS jsonb LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RETURN '[]'::jsonb;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_asset_usage(_asset_id uuid)
RETURNS jsonb LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RETURN '[]'::jsonb;
END;
$$;

-- Part 3: RPC Sync
CREATE OR REPLACE FUNCTION public.admin_list_inventory_pools()
RETURNS jsonb LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RETURN '[]'::jsonb;
END;
$$;

-- Part 4: RLS & Grants
ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_asset_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins have full access" ON public.media_assets FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins have full access" ON public.media_asset_usage FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

GRANT ALL ON public.media_assets, public.media_asset_usage TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.media_assets, public.media_asset_usage TO authenticated;
GRANT SELECT ON public.media_assets TO anon;
