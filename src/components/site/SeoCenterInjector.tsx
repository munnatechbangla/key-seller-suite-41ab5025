// SEO Center runtime — injects verification meta, extra analytics pixels,
// custom scripts, performance hints, cookie consent banner, and applies
// admin-configured URL redirects on the client.
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { useSettings } from "@/lib/cms/settings";
import { supabase } from "@/integrations/supabase/client";

const COOKIE_STORAGE = "cookie_consent_v1";

function appendScript(id: string, attrs: Record<string, string>, body?: string) {
  if (typeof document === "undefined" || document.getElementById(id)) return;
  const s = document.createElement("script");
  s.id = id;
  for (const [k, v] of Object.entries(attrs)) s.setAttribute(k, v);
  if (body) s.text = body;
  document.head.appendChild(s);
}

function appendRaw(id: string, html: string, where: "head" | "body-start" | "body-end") {
  if (typeof document === "undefined" || !html.trim() || document.getElementById(id)) return;
  const wrap = document.createElement("div");
  wrap.id = id;
  wrap.style.display = "none";
  const tpl = document.createElement("template");
  tpl.innerHTML = html;
  wrap.appendChild(tpl.content);
  if (where === "head") document.head.appendChild(wrap);
  else if (where === "body-start") document.body.insertBefore(wrap, document.body.firstChild);
  else document.body.appendChild(wrap);
  wrap.querySelectorAll("script").forEach((old) => {
    const ns = document.createElement("script");
    for (const a of Array.from(old.attributes)) ns.setAttribute(a.name, a.value);
    ns.text = old.textContent ?? "";
    old.replaceWith(ns);
  });
}

function ensureMeta(name: string, content: string) {
  if (typeof document === "undefined" || !content) return;
  let el = document.head.querySelector<HTMLMetaElement>(`meta[name='${name}']`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("name", name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function ensureLink(rel: string, href: string, crossOrigin?: string) {
  if (typeof document === "undefined" || !href) return;
  const id = `seoc-${rel}-${href}`;
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = rel;
  link.href = href;
  if (crossOrigin) link.crossOrigin = crossOrigin;
  document.head.appendChild(link);
}

export function SeoCenterInjector() {
  const s = useSettings((st) => st.settings.seo_center);
  const loaded = useSettings((st) => st.loaded);
  const navigate = useNavigate();
  const location = useLocation({ select: (l) => l.pathname });
  const [redirects, setRedirects] = useState<{ source_path: string; target_path: string; status_code: number }[]>([]);
  const [consent, setConsent] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setConsent(window.localStorage.getItem(COOKIE_STORAGE));
  }, []);

  // Load redirects once
  useEffect(() => {
    if (!loaded) return;
    (async () => {
      try {
        const { data } = await (supabase as any)
          .from("redirects")
          .select("source_path,target_path,status_code")
          .eq("enabled", true);
        setRedirects(data ?? []);
      } catch { /* ignore */ }
    })();
  }, [loaded]);

  // Apply redirects on route change
  useEffect(() => {
    if (!redirects.length) return;
    const match = redirects.find((r) => r.source_path === location);
    if (!match) return;
    if (match.status_code === 410) return; // Let UI show gone.
    if (/^https?:\/\//i.test(match.target_path)) {
      window.location.replace(match.target_path);
    } else {
      navigate({ to: match.target_path, replace: true });
    }
  }, [location, redirects, navigate]);

  // Inject verification + performance + pixels + custom scripts
  useEffect(() => {
    if (!s || typeof document === "undefined") return;

    if (s.google_site_verification) ensureMeta("google-site-verification", s.google_site_verification);
    if (s.bing_site_verification) ensureMeta("msvalidate.01", s.bing_site_verification);
    if (s.yandex_verification) ensureMeta("yandex-verification", s.yandex_verification);
    if (s.pinterest_verification) ensureMeta("p:domain_verify", s.pinterest_verification);
    if (s.facebook_domain_verification) ensureMeta("facebook-domain-verification", s.facebook_domain_verification);

    // Performance
    s.preconnect_urls.split(/\s+/).filter(Boolean).forEach((u) => ensureLink("preconnect", u, "anonymous"));
    s.dns_prefetch_urls.split(/\s+/).filter(Boolean).forEach((u) => ensureLink("dns-prefetch", u));

    // Extra pixels
    if (s.tiktok_pixel_id) {
      appendScript("seoc-ttq", {}, `!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"];ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var o=d.createElement("script");o.type="text/javascript",o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;var a=d.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};ttq.load(${JSON.stringify(s.tiktok_pixel_id)});ttq.page();}(window,document,'ttq');`);
    }
    if (s.clarity_id) {
      appendScript("seoc-clarity", {}, `(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script",${JSON.stringify(s.clarity_id)});`);
    }
    if (s.linkedin_partner_id) {
      appendScript("seoc-li-init", {}, `_linkedin_partner_id=${JSON.stringify(s.linkedin_partner_id)};window._linkedin_data_partner_ids=window._linkedin_data_partner_ids||[];window._linkedin_data_partner_ids.push(_linkedin_partner_id);`);
      appendScript("seoc-li-loader", { src: "https://snap.licdn.com/li.lms-analytics/insight.min.js", async: "true" });
    }
    if (s.snap_pixel_id) {
      appendScript("seoc-snap", {}, `(function(e,t,n){if(e.snaptr)return;var a=e.snaptr=function(){a.handleRequest?a.handleRequest.apply(a,arguments):a.queue.push(arguments)};a.queue=[];var s='script';r=t.createElement(s);r.async=!0;r.src=n;var u=t.getElementsByTagName(s)[0];u.parentNode.insertBefore(r,u);})(window,document,'https://sc-static.net/scevent.min.js');snaptr('init',${JSON.stringify(s.snap_pixel_id)});snaptr('track','PAGE_VIEW');`);
    }

    // Custom scripts
    if (s.head_scripts) appendRaw("seoc-head", s.head_scripts, "head");
    if (s.body_start_scripts) appendRaw("seoc-body-start", s.body_start_scripts, "body-start");
    if (s.body_end_scripts) appendRaw("seoc-body-end", s.body_end_scripts, "body-end");
    if (s.footer_scripts) appendRaw("seoc-footer", s.footer_scripts, "body-end");
    if (s.custom_analytics) appendRaw("seoc-analytics", s.custom_analytics, "head");
  }, [s]);

  if (!s || !s.cookie_enabled || consent) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-[9999] p-4 bg-background/95 backdrop-blur border-t shadow-lg">
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-start md:items-center gap-3">
        <p className="text-sm text-muted-foreground flex-1">
          {s.cookie_banner_text}{" "}
          {s.cookie_privacy_url && (
            <a href={s.cookie_privacy_url} className="underline">Privacy Policy</a>
          )}
        </p>
        <div className="flex gap-2 flex-wrap">
          <button
            className="px-3 py-1.5 text-sm rounded-md border"
            onClick={() => { window.localStorage.setItem(COOKIE_STORAGE, "rejected"); setConsent("rejected"); }}
          >{s.cookie_reject_label}</button>
          <button
            className="px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground"
            onClick={() => { window.localStorage.setItem(COOKIE_STORAGE, "accepted"); setConsent("accepted"); }}
          >{s.cookie_accept_label}</button>
        </div>
      </div>
    </div>
  );
}
