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

/** Reactive hook — resolves any stored value to a browser URL. Exposes `loading` so callers can avoid a flash of fallback content. */
export function useResolvedMediaUrl(stored: string | null | undefined): { url: string; loading: boolean } {
  const settingsLoaded = useSettings((s) => s.loaded);
  const [url, setUrl] = useState<string>("");
  const [resolving, setResolving] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    if (!settingsLoaded) return;
    if (!stored) { setUrl(""); setResolving(false); return; }
    setResolving(true);
    resolveStoredUrlAsync(stored).then((v) => {
      if (cancelled) return;
      setUrl(v);
      setResolving(false);
    });
    return () => { cancelled = true; };
  }, [stored, settingsLoaded]);

  return { url, loading: !settingsLoaded || resolving };
}

/** Current logo URL + loading flag. `loading` is true until settings load AND (if a logo is configured) it is resolved. */
export function useSiteLogo(): { logoUrl: string; loading: boolean } {
  const logo = useSettings((s) => s.settings.branding.logo_url);
  const { url, loading } = useResolvedMediaUrl(logo);
  return { logoUrl: url, loading };
}

/** Current favicon URL. */
export function useSiteFavicon(): string {
  const fav = useSettings((s) => s.settings.branding.favicon_url);
  return useResolvedMediaUrl(fav).url;
}
