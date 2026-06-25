// White-label analytics tracking helpers. No-op on the server.
// Dispatches commerce events to GA4 (gtag), GTM (dataLayer), and Meta Pixel (fbq)
// if those globals exist (injected by AnalyticsScripts based on admin settings).

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    dataLayer?: any[];
    gtag?: (...args: any[]) => void;
    fbq?: (...args: any[]) => void;
  }
}

export type EcomItem = {
  item_id: string;
  item_name: string;
  price?: number;
  quantity?: number;
  item_category?: string;
};

type EventName =
  | "page_view"
  | "view_item"
  | "add_to_cart"
  | "begin_checkout"
  | "purchase"
  | "search"
  | "coupon_applied";

function safe(fn: () => void) {
  if (typeof window === "undefined") return;
  try { fn(); } catch { /* noop */ }
}

export function track(event: EventName, params: Record<string, any> = {}) {
  safe(() => {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event, ...params });
    if (typeof window.gtag === "function") window.gtag("event", event, params);
    if (typeof window.fbq === "function") {
      const map: Record<EventName, string | null> = {
        page_view: "PageView",
        view_item: "ViewContent",
        add_to_cart: "AddToCart",
        begin_checkout: "InitiateCheckout",
        purchase: "Purchase",
        search: "Search",
        coupon_applied: null,
      };
      const fb = map[event];
      if (fb) window.fbq("track", fb, params);
    }
  });
}

// ---- Validation helpers used by the admin Settings form ----
export function isValidGa4(id: string): boolean {
  if (!id) return true;
  return /^G-[A-Z0-9]{4,}$/i.test(id.trim());
}
export function isValidGtm(id: string): boolean {
  if (!id) return true;
  return /^GTM-[A-Z0-9]{4,}$/i.test(id.trim());
}
export function isValidMetaPixel(id: string): boolean {
  if (!id) return true;
  return /^\d{6,}$/.test(id.trim());
}
