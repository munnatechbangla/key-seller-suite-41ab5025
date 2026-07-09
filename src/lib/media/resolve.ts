import { supabase } from "@/integrations/supabase/client";

/**
 * Returns a permanent URL for a media asset.
 * - Public bucket: canonical `/object/public/media/<path>` URL.
 * - Private bucket / missing path: `media://<path>` identifier the frontend can resolve.
 * Never returns an expiring signed URL.
 */
export function resolveMediaUrl(asset: { storage_path?: string | null; public_url?: string | null } | null | undefined): string {
  if (!asset) return "";
  if (asset.storage_path) {
    const { data } = supabase.storage.from("media").getPublicUrl(asset.storage_path);
    if (data?.publicUrl) return data.publicUrl;
    return `media://${asset.storage_path}`;
  }
  return asset.public_url ?? "";
}
