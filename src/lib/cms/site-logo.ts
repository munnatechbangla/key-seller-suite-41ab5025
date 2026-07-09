// Single source of truth for the current site logo & favicon URLs.
// Storage bucket is PRIVATE — we store `media://<path>` tokens and resolve
// them into fresh signed URLs on demand at render time.
import { useEffect, useState } from "react";
import { useSettings } from "@/lib/cms/settings";
import { extractMediaPath, resolveStoredUrlAsync } from "@/lib/media/resolve";

/** Backwards-compat sync passthrough. Real resolution is async via the hooks below. */
export function resolveStoredUrl(url: string | null | undefined): string {
  if (!url) return "";
  if (/^(https?:|data:|blob:)/i.test(url) && !extractMediaPath(url)) return url;
  return "";
}

/** Reactive hook — resolves any stored value (`media://…`, legacy public URL, or plain http) to a browser URL. */
export function useResolvedMediaUrl(stored: string | null | undefined): string {
  const [url, setUrl] = useState<string>("");
  useEffect(() => {
    let cancelled = false;
    if (!stored) { setUrl(""); return; }
    resolveStoredUrlAsync(stored).then((v) => { if (!cancelled) setUrl(v); });
    return () => { cancelled = true; };
  }, [stored]);
  return url;
}

/** Current logo URL (fresh signed URL when backed by a `media://` token). */
export function useSiteLogo(): string {
  const logo = useSettings((s) => s.settings.branding.logo_url);
  return useResolvedMediaUrl(logo);
}

/** Current favicon URL. */
export function useSiteFavicon(): string {
  const fav = useSettings((s) => s.settings.branding.favicon_url);
  return useResolvedMediaUrl(fav);
}
