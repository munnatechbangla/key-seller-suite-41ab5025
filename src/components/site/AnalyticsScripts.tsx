// Runtime analytics injector. Reads from `site_settings.analytics` and
// injects only the enabled providers. Pageview events are tracked on every
// router location change.
import { useEffect, useRef } from "react";
import { useLocation } from "@tanstack/react-router";
import { useSettings } from "@/lib/cms/settings";
import { track } from "@/lib/analytics/track";

function appendScript(id: string, attrs: Record<string, string>, body?: string) {
  if (document.getElementById(id)) return;
  const s = document.createElement("script");
  s.id = id;
  for (const [k, v] of Object.entries(attrs)) s.setAttribute(k, v);
  if (body) s.text = body;
  document.head.appendChild(s);
}

function appendRaw(id: string, html: string, where: "head" | "body") {
  if (!html.trim() || document.getElementById(id)) return;
  const tpl = document.createElement("template");
  tpl.innerHTML = html;
  const wrap = document.createElement("div");
  wrap.id = id;
  wrap.style.display = "none";
  wrap.appendChild(tpl.content);
  (where === "head" ? document.head : document.body).appendChild(wrap);
  // Re-execute any <script> tags inside (template content scripts don't run).
  wrap.querySelectorAll("script").forEach((old) => {
    const ns = document.createElement("script");
    for (const a of Array.from(old.attributes)) ns.setAttribute(a.name, a.value);
    ns.text = old.textContent ?? "";
    old.replaceWith(ns);
  });
}

export function AnalyticsScripts() {
  const a = useSettings((s) => s.settings.analytics);
  const location = useLocation({ select: (l) => `${l.pathname}${l.searchStr ?? ""}` });
  const firstPage = useRef(true);

  useEffect(() => {
    if (typeof document === "undefined" || !a) return;

    if (a.ga4_enabled && a.ga4_id) {
      appendScript("th-ga4-loader", {
        src: `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(a.ga4_id)}`,
        async: "true",
      });
      appendScript(
        "th-ga4-init",
        {},
        `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}window.gtag=gtag;gtag('js',new Date());gtag('config',${JSON.stringify(a.ga4_id)},{send_page_view:false});`,
      );
    }

    if (a.gtm_enabled && a.gtm_id) {
      appendScript(
        "th-gtm",
        {},
        `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer',${JSON.stringify(a.gtm_id)});`,
      );
    }

    if (a.meta_pixel_enabled && a.meta_pixel_id) {
      appendScript(
        "th-fbq",
        {},
        `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init',${JSON.stringify(a.meta_pixel_id)});`,
      );
    }

    if (a.custom_header_enabled && a.custom_header) appendRaw("th-custom-head", a.custom_header, "head");
    if (a.custom_footer_enabled && a.custom_footer) appendRaw("th-custom-foot", a.custom_footer, "body");
  }, [a]);

  // Pageview on every navigation (including initial mount).
  useEffect(() => {
    if (!a) return;
    if (firstPage.current) firstPage.current = false;
    track("page_view", { page_path: location });
  }, [location, a]);

  return null;
}
