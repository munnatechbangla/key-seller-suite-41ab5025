/**
 * Environment-aware canonical site origin used for auth redirects.
 *
 * - Local development (localhost / 127.0.0.1) -> current origin
 * - Lovable previews -> current origin (so preview sign-in stays in preview)
 * - Production -> VITE_SITE_URL, defaulting to https://topuphut.com
 */
const PRODUCTION_URL = (
  (import.meta.env['VITE_SITE_URL'] as string | undefined) || "https://topuphut.com"
).replace(/\/+$/, "");

export function getSiteOrigin(): string {
  if (typeof window === "undefined") return PRODUCTION_URL;
  const { hostname, origin } = window.location;
  const isLocal =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".lovable.app") ||
    hostname.endsWith(".lovableproject.com");
  return isLocal ? origin.replace(/\/+$/, "") : PRODUCTION_URL;
}

export function siteUrl(path = "/"): string {
  return `${getSiteOrigin()}${path.startsWith("/") ? path : `/${path}`}`;
}
