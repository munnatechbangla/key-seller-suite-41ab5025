/**
 * Signed preview URL generator (client-side token, UX layer only).
 *
 * Generates a short-lived opaque token, stores it in sessionStorage keyed by
 * product id, and returns a URL to the storefront route with `?preview=<token>`.
 * The storefront can honor the token to render drafts in a follow-up phase —
 * this module owns the URL/UX contract only, no backend changes here.
 */

const KEY = "lovable.admin.preview.tokens.v1";
const TTL_MS = 30 * 60 * 1000; // 30 minutes

interface TokenRec {
  token: string;
  productId: string;
  slug: string;
  createdAt: number;
  expiresAt: number;
}

type Store = Record<string, TokenRec>;

function read(): Store {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Store) : {};
  } catch {
    return {};
  }
}

function write(next: Store) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

function randomToken(): string {
  const arr = new Uint8Array(18);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) crypto.getRandomValues(arr);
  else for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function generateSignedPreview(productId: string, slug: string) {
  const now = Date.now();
  const rec: TokenRec = {
    token: randomToken(),
    productId,
    slug,
    createdAt: now,
    expiresAt: now + TTL_MS,
  };
  const store = read();
  store[productId] = rec;
  write(store);
  const base = typeof window !== "undefined" ? window.location.origin : "";
  const url = `${base}/products/${encodeURIComponent(slug)}?preview=${rec.token}&exp=${rec.expiresAt}`;
  return { ...rec, url, ttlMinutes: Math.round(TTL_MS / 60000) };
}

export function getActivePreview(productId: string) {
  const rec = read()[productId];
  if (!rec) return null;
  if (rec.expiresAt < Date.now()) return null;
  return rec;
}
