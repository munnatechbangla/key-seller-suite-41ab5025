// Single source of truth for the current site logo & favicon URLs.
// Storage bucket is PRIVATE — the branding store owns a CACHED signed URL
// that is (re)generated only on first app load and after Branding settings save.
// Components must NEVER call createSignedUrl themselves for the site logo.
import { useEffect, useRef, useState } from "react";
import { useSettings } from "@/lib/cms/settings";
import { extractMediaPath, resolveStoredUrlAsync } from "@/lib/media/resolve";

/** Backwards-compat sync passthrough. Real resolution is async. */
export function resolveStoredUrl(url: string | null | undefined): string {
  if (!url) return "";
  if (/^(https?:|data:|blob:)/i.test(url) && !extractMediaPath(url)) return url;
  return "";
}

/**
 * Ad-hoc resolver for arbitrary stored values (e.g. MediaPicker preview of a
 * newly-selected asset). Signs on demand and caches within the hook instance.
 * Do NOT use for the site logo — read from the settings store instead.
 */
export function useResolvedMediaUrl(stored: string | null | undefined): { url: string; loading: boolean } {
  const settingsLoaded = useSettings((s) => s.loaded);
  const [url, setUrl] = useState<string>("");
  const [resolving, setResolving] = useState<boolean>(false);
  const lastSrc = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!settingsLoaded) return;
    const src = stored ?? "";
    if (lastSrc.current === src) return;
    lastSrc.current = src;
    if (!src) { setUrl(""); setResolving(false); return; }
    setResolving(true);
    resolveStoredUrlAsync(src).then((v) => {
      if (cancelled) return;
      setUrl(v);
      setResolving(false);
    });
    return () => { cancelled = true; };
  }, [stored, settingsLoaded]);

  return { url, loading: !settingsLoaded || resolving };
}

/** Current logo URL from the cached store value — no per-mount signing. */
export function useSiteLogo(): { logoUrl: string; loading: boolean } {
  const configured = useSettings((s) => !!s.settings.branding.logo_url);
  const loaded = useSettings((s) => s.loaded);
  const resolving = useSettings((s) => s.resolvingMedia);
  const logoUrl = useSettings((s) => s.resolvedLogoUrl);
  // "loading" only while we truly don't know yet: settings not loaded, or a
  // logo is configured but hasn't been resolved once yet.
  const loading = !loaded || (configured && !logoUrl && resolving);
  return { logoUrl, loading };
}

/** Current favicon URL from the cached store value. */
export function useSiteFavicon(): string {
  return useSettings((s) => s.resolvedFaviconUrl);
}
