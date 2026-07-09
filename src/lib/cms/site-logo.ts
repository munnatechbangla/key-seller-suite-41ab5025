// Single source of truth for the current site logo & favicon URLs.
// Every surface (Header, Mobile header, Footer, AuthShell, Admin, favicon)
// must read through these helpers so a Branding save updates them instantly.
import { useSettings } from "@/lib/cms/settings";
import { supabase } from "@/integrations/supabase/client";

/** Resolve a stored URL — passes through http(s)/data/blob, converts `media://<path>` to a permanent public URL. */
export function resolveStoredUrl(url: string | null | undefined): string {
  if (!url) return "";
  if (url.startsWith("media://")) {
    const path = url.slice("media://".length);
    const { data } = supabase.storage.from("media").getPublicUrl(path);
    return data?.publicUrl ?? "";
  }
  return url;
}

/** Reactive hook — returns the current logo URL from site_settings (or "" when unset). */
export function useSiteLogo(): string {
  const logo = useSettings((s) => s.settings.branding.logo_url);
  return resolveStoredUrl(logo);
}

/** Reactive hook — returns the current favicon URL from site_settings (or "" when unset). */
export function useSiteFavicon(): string {
  const fav = useSettings((s) => s.settings.branding.favicon_url);
  return resolveStoredUrl(fav);
}
