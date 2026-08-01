// Single source of truth for the current site logo & favicon URLs.
// Storage bucket is PRIVATE — the branding store owns a CACHED signed URL
// that is (re)generated only on first app load and after Branding settings save.
// Components must NEVER call createSignedUrl themselves for the site logo.
import { useEffect, useRef, useState } from "react";
import { useSettings } from "@/lib/cms/settings";
import { useTheme, resolveTheme } from "@/lib/theme";
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

/** Live resolved theme ("light" | "dark") — reacts to user theme changes AND OS changes when in "system" mode. */
export function useResolvedTheme(): "light" | "dark" {
  const mode = useTheme((s) => s.mode);
  const [resolved, setResolved] = useState<"light" | "dark">(() => resolveTheme(mode));
  useEffect(() => {
    setResolved(resolveTheme(mode));
    if (mode !== "system" || typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => setResolved(resolveTheme("system"));
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [mode]);
  return resolved;
}

/**
 * Theme-aware logo URL from the cached store value.
 * Priority: theme-specific resolved logo → generic resolved logo → "".
 * Fallback to the text wordmark is handled by <Logo /> when logoUrl is "".
 */
export function useSiteLogo(forceTheme?: "light" | "dark"): { logoUrl: string; loading: boolean } {
  // Cached (localStorage) logo URLs are only valid after hydration; rendering
  // them on the first client pass would mismatch the SSR skeleton.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => { setHydrated(true); }, []);
  const resolvedTheme = useResolvedTheme();
  const theme = forceTheme ?? resolvedTheme;
  const configured = useSettings((s) => {
    const b = s.settings.branding;
    return !!(theme === "dark"
      ? (b.dark_logo_url || b.logo_url)
      : (b.light_logo_url || b.logo_url));
  });
  const loaded = useSettings((s) => s.loaded);
  const resolving = useSettings((s) => s.resolvingMedia);
  const genericUrl = useSettings((s) => s.resolvedLogoUrl);
  const lightUrl = useSettings((s) => s.resolvedLightLogoUrl);
  const darkUrl = useSettings((s) => s.resolvedDarkLogoUrl);
  const themedUrl = theme === "dark"
    ? (darkUrl || genericUrl)
    : (lightUrl || genericUrl);
  if (themedUrl) return { logoUrl: themedUrl, loading: false };
  const loading = !loaded || (configured && resolving);
  return { logoUrl: "", loading };
}


/** Current favicon URL from the cached store value. */
export function useSiteFavicon(): string {
  return useSettings((s) => s.resolvedFaviconUrl);
}
