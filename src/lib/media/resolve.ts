import { supabase } from "@/integrations/supabase/client";

// Long-lived signed URL TTL (10 years). Bucket is private; we never store signed URLs.
const SIGNED_TTL_SECONDS = 60 * 60 * 24 * 365 * 10;
const BUCKET = "media";

/**
 * Canonical stored form for any media asset selected from the Media Library.
 * We ALWAYS persist `media://<storage_path>` — never public/signed URLs.
 */
export function resolveMediaUrl(
  asset: { storage_path?: string | null; public_url?: string | null } | null | undefined,
): string {
  if (!asset) return "";
  if (asset.storage_path) return `media://${asset.storage_path}`;
  // Legacy row without storage_path: fall back to whatever is stored (may be a legacy public URL).
  return asset.public_url ?? "";
}

/** Extract the storage path from `media://` or a legacy Supabase Storage URL. Returns null when unknown. */
export function extractMediaPath(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.startsWith("media://")) return value.slice("media://".length);
  // Legacy: `.../storage/v1/object/public/media/<path>` or `.../object/sign/media/<path>?token=...`
  const m = value.match(/\/storage\/v1\/object\/(?:public|sign)\/media\/([^?#]+)/);
  if (m && m[1]) return decodeURIComponent(m[1]);
  return null;
}

/** Async resolve a stored value into a URL the browser can load. Signs `media://` tokens on demand. */
export async function resolveStoredUrlAsync(value: string | null | undefined): Promise<string> {
  if (!value) return "";
  const path = extractMediaPath(value);
  if (path) {
    try {
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_TTL_SECONDS);
      if (error || !data?.signedUrl) return "";
      return data.signedUrl;
    } catch {
      return "";
    }
  }
  if (/^(https?:|data:|blob:)/i.test(value)) return value;
  return "";
}
