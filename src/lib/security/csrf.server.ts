// CSRF protection for unauthenticated (guest) server functions.
//
// TanStack server functions are same-origin XHR/fetch calls. A standard CSRF
// attack relies on a cross-origin form submission — we block those by
// requiring the request's Origin (or Referer fallback) to match the request's
// own host. Same-origin requests (the legitimate app) always pass.
//
// This is intentionally permissive on missing headers ONLY when neither is
// present AND the request is same-site (browser strips Origin on some
// navigations); for POST server functions the browser always sends Origin.

import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

function hostFromUrl(value: string | null): string | null {
  if (!value) return null;
  try { return new URL(value).host; } catch { return null; }
}

export const csrfGuard = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const req = getRequest();
    if (!req) return next();
    const method = req.method.toUpperCase();
    // Only enforce on state-changing methods.
    if (method === "GET" || method === "HEAD" || method === "OPTIONS") return next();

    const expectedHost =
      req.headers.get("x-forwarded-host") ||
      req.headers.get("host") ||
      hostFromUrl(req.url);
    if (!expectedHost) return next();

    const origin = hostFromUrl(req.headers.get("origin"));
    const referer = hostFromUrl(req.headers.get("referer"));
    const source = origin ?? referer;

    // Browsers always send Origin on POST cross-origin fetch. Absence on a
    // POST is suspicious — reject.
    if (!source) {
      throw new Error("CSRF: missing origin/referer");
    }
    if (source !== expectedHost) {
      throw new Error("CSRF: cross-origin request blocked");
    }
    return next();
  },
);
