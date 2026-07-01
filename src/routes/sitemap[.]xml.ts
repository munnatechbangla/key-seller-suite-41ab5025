import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { getRuntimeEnv } from "@/lib/runtime-env";

interface SitemapEntry {
  path: string;
  lastmod?: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

const STATIC_ENTRIES: SitemapEntry[] = [
  { path: "/", changefreq: "daily", priority: "1.0" },
  { path: "/products", changefreq: "daily", priority: "0.9" },
  { path: "/categories", changefreq: "weekly", priority: "0.8" },
  { path: "/about", changefreq: "monthly", priority: "0.5" },
  { path: "/contact", changefreq: "monthly", priority: "0.5" },
  { path: "/blog", changefreq: "weekly", priority: "0.6" },
  { path: "/faq", changefreq: "monthly", priority: "0.4" },
  { path: "/support", changefreq: "monthly", priority: "0.4" },
  { path: "/privacy", changefreq: "yearly", priority: "0.3" },
  { path: "/terms", changefreq: "yearly", priority: "0.3" },
  { path: "/refund", changefreq: "yearly", priority: "0.3" },
];

async function resolveBaseUrl(request: Request): Promise<string> {
  // Try site_settings.seo.site_url first; fall back to the request origin.
  try {
    const url = getRuntimeEnv("SUPABASE_URL");
    const key = getRuntimeEnv("SUPABASE_PUBLISHABLE_KEY");
    if (url && key) {
      const sb = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data } = await sb
        .from("site_settings")
        .select("value")
        .eq("key", "seo")
        .maybeSingle();
      const siteUrl = (data?.value as { site_url?: string } | null)?.site_url;
      if (siteUrl) return siteUrl.replace(/\/$/, "");
    }
  } catch {
    // ignore
  }
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  const host = request.headers.get("host") ?? "";
  return host ? `${proto}://${host}` : "";
}

async function fetchDynamicEntries(): Promise<SitemapEntry[]> {
  const url = getRuntimeEnv("SUPABASE_URL");
  const key = getRuntimeEnv("SUPABASE_PUBLISHABLE_KEY");
  if (!url || !key) return [];
  const sb = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const out: SitemapEntry[] = [];
  try {
    const { data: products } = await sb
      .from("products")
      .select("slug, updated_at")
      .eq("status", "published")
      .limit(5000);
    for (const p of products ?? []) {
      out.push({
        path: `/products/${p.slug}`,
        lastmod: p.updated_at ? new Date(p.updated_at).toISOString() : undefined,
        changefreq: "weekly",
        priority: "0.8",
      });
    }
  } catch {/* ignore */}
  try {
    const { data: cats } = await sb
      .from("product_categories")
      .select("slug, updated_at")
      .limit(500);
    for (const c of cats ?? []) {
      out.push({
        path: `/categories/${c.slug}`,
        lastmod: c.updated_at ? new Date(c.updated_at).toISOString() : undefined,
        changefreq: "weekly",
        priority: "0.6",
      });
    }
  } catch {/* ignore */}
  return out;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const baseUrl = await resolveBaseUrl(request);
        const dynamic = await fetchDynamicEntries();
        const entries = [...STATIC_ENTRIES, ...dynamic];

        const urls = entries.map((e) =>
          [
            `  <url>`,
            `    <loc>${baseUrl}${e.path}</loc>`,
            e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
            `  </url>`,
          ].filter(Boolean).join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
