import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

// ------------- Health Check -------------
export const adminHealthCheckFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const sb = context.supabase;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const checks: Array<{ id: string; label: string; status: "pass" | "warn" | "fail"; detail?: string; fix?: string }> = [];

    // 1. Supabase connection
    try {
      const { error } = await sb.from("site_settings").select("id", { head: true, count: "exact" });
      checks.push({ id: "db", label: "Database connection", status: error ? "fail" : "pass", detail: error?.message });
    } catch (e: any) {
      checks.push({ id: "db", label: "Database connection", status: "fail", detail: e.message });
    }

    // 2. Core tables present (treat as migrations sanity check)
    const required = ["orders", "products", "payment_gateways", "email_templates", "legal_pages", "setup_state"];
    let missing: string[] = [];
    for (const t of required) {
      const { error } = await sb.from(t as any).select("*", { head: true, count: "exact" });
      if (error) missing.push(t);
    }
    checks.push({
      id: "migrations",
      label: "Database migrations",
      status: missing.length ? "fail" : "pass",
      detail: missing.length ? `Missing tables: ${missing.join(", ")}` : "All required tables present",
      fix: missing.length ? "Re-run migrations from Lovable" : undefined,
    });

    // 3. Storage buckets
    try {
      const { data: buckets } = await supabaseAdmin.storage.listBuckets();
      const hasPayments = (buckets ?? []).some((b: any) => b.name === "payments");
      checks.push({
        id: "storage",
        label: "Storage buckets",
        status: hasPayments ? "pass" : "warn",
        detail: hasPayments ? "payments bucket present" : "payments bucket missing",
        fix: hasPayments ? undefined : "Create a private 'payments' bucket",
      });
    } catch (e: any) {
      checks.push({ id: "storage", label: "Storage buckets", status: "warn", detail: e.message });
    }

    // 4. Settings completeness
    const { data: rows } = await sb.from("site_settings").select("group_key,setting_key,value");
    const get = (g: string, k: string) => (rows ?? []).find((r: any) => r.group_key === g && r.setting_key === k)?.value as any;
    const branding = get("site", "branding") ?? {};
    const seo = get("seo", "defaults") ?? {};
    const contact = get("site", "contact") ?? {};
    const email = get("email", "senders") ?? {};
    const payment = get("payment", "config") ?? {};
    const analytics = get("analytics", "config") ?? {};

    checks.push({
      id: "branding",
      label: "Branding configured",
      status: branding.name && branding.tagline ? "pass" : "warn",
      detail: branding.name ? `Brand: ${branding.name}` : "Brand name missing",
      fix: "Admin → Settings → Branding",
    });
    checks.push({
      id: "seo",
      label: "SEO defaults",
      status: seo.site_title && seo.meta_description && seo.site_url ? "pass" : "warn",
      detail: seo.site_url ? `Site URL: ${seo.site_url}` : "Site URL missing",
      fix: "Admin → Settings → SEO",
    });
    checks.push({
      id: "contact",
      label: "Contact info",
      status: contact.support_email ? "pass" : "warn",
      detail: contact.support_email ?? "Support email missing",
      fix: "Admin → Settings → Contact",
    });
    checks.push({
      id: "email",
      label: "Email configuration",
      status: email.sender_email ? "pass" : "warn",
      detail: email.sender_email ?? "Sender email not set — emails run in dev mode",
      fix: "Connect a sender domain and set Email → Senders",
    });

    // 5. Payment gateways enabled
    const { data: gateways } = await sb.from("payment_gateways").select("slug,is_enabled").eq("is_enabled", true);
    const enabledCount = (gateways ?? []).length;
    const manualEnabled = (payment as any).manual_enabled;
    checks.push({
      id: "payment",
      label: "Payment gateways",
      status: enabledCount > 0 || manualEnabled ? "pass" : "fail",
      detail: enabledCount > 0 ? `${enabledCount} gateway(s) enabled` : "No payment gateway enabled",
      fix: "Admin → Gateways",
    });

    // 6. Analytics
    const anyAnalytics = analytics.ga4_enabled || analytics.gtm_enabled || analytics.meta_pixel_enabled;
    checks.push({
      id: "analytics",
      label: "Analytics",
      status: anyAnalytics ? "pass" : "warn",
      detail: anyAnalytics ? "At least one analytics provider enabled" : "No analytics provider configured",
      fix: "Admin → Settings → Analytics",
    });

    // 7. Setup wizard completion
    const { data: setup } = await sb.from("setup_state").select("is_completed").eq("id", 1).maybeSingle();
    checks.push({
      id: "setup",
      label: "Setup wizard",
      status: setup?.is_completed ? "pass" : "fail",
      detail: setup?.is_completed ? "Completed" : "Setup not finished — public routes redirect to /setup",
      fix: "Admin → Setup Wizard",
    });

    return { checks, generatedAt: new Date().toISOString() };
  });

// ------------- Demo Data Tools -------------
const ClearScope = z.enum(["orders", "customers", "reviews", "coupons", "licenses", "all"]);

export const adminClearDataFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { scope: z.infer<typeof ClearScope> }) => ({ scope: ClearScope.parse(input.scope) }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const scopes = data.scope === "all"
      ? (["orders", "reviews", "coupons", "licenses", "customers"] as const)
      : ([data.scope] as const);

    const summary: Record<string, number | string> = {};

    for (const s of scopes) {
      if (s === "orders") {
        const { count: c1 } = await supabaseAdmin.from("license_assignments").delete({ count: "exact" }).not("id", "is", null);
        const { count: c2 } = await supabaseAdmin.from("downloads").delete({ count: "exact" }).not("id", "is", null);
        const { count: c3 } = await supabaseAdmin.from("manual_payment_submissions").delete({ count: "exact" }).not("id", "is", null);
        const { count: c4 } = await supabaseAdmin.from("payments").delete({ count: "exact" }).not("id", "is", null);
        const { count: c5 } = await supabaseAdmin.from("payment_intents").delete({ count: "exact" }).not("id", "is", null);
        const { count: c6 } = await supabaseAdmin.from("order_items").delete({ count: "exact" }).not("id", "is", null);
        const { count: c7 } = await supabaseAdmin.from("orders").delete({ count: "exact" }).not("id", "is", null);
        summary.orders = (c1 ?? 0) + (c2 ?? 0) + (c3 ?? 0) + (c4 ?? 0) + (c5 ?? 0) + (c6 ?? 0) + (c7 ?? 0);
      } else if (s === "reviews") {
        const { count } = await supabaseAdmin.from("product_reviews").delete({ count: "exact" }).not("id", "is", null);
        summary.reviews = count ?? 0;
      } else if (s === "coupons") {
        await supabaseAdmin.from("coupon_usage").delete().not("id", "is", null);
        const { count } = await supabaseAdmin.from("coupons").delete({ count: "exact" }).not("id", "is", null);
        summary.coupons = count ?? 0;
      } else if (s === "licenses") {
        await supabaseAdmin.from("license_assignments").delete().not("id", "is", null);
        const { count } = await supabaseAdmin.from("license_keys").delete({ count: "exact" }).not("id", "is", null);
        summary.licenses = count ?? 0;
      } else if (s === "customers") {
        // Keep admin profiles; only delete non-admin profiles.
        const { data: adminRows } = await supabaseAdmin.from("user_roles").select("user_id").eq("role", "admin");
        const adminIds = (adminRows ?? []).map((r: any) => r.user_id);
        let q = supabaseAdmin.from("profiles").delete({ count: "exact" }).not("id", "is", null);
        if (adminIds.length) q = q.not("id", "in", `(${adminIds.join(",")})`);
        const { count } = await q;
        summary.customers = count ?? 0;
      }
    }

    return { ok: true, summary };
  });

export const adminSeedDemoFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const categories = [
      { slug: "ai-tools", name: "AI Tools", description: "AI subscriptions and tools" },
      { slug: "design", name: "Design", description: "Design software subscriptions" },
      { slug: "streaming", name: "Streaming", description: "Streaming services" },
    ];
    await supabaseAdmin.from("product_categories").upsert(categories as any, { onConflict: "slug" });

    const { data: cats } = await supabaseAdmin.from("product_categories").select("id,slug");
    const catId = (slug: string) => cats?.find((c: any) => c.slug === slug)?.id;

    const products = [
      { slug: "demo-chatgpt-plus", name: "Demo ChatGPT Plus", short_description: "1 month subscription (demo)", description: "Sample product", price: 25, sale_price: 19, status: "published", type: "simple", category_id: catId("ai-tools") },
      { slug: "demo-canva-pro", name: "Demo Canva Pro", short_description: "12 months (demo)", description: "Sample product", price: 60, sale_price: 35, status: "published", type: "simple", category_id: catId("design") },
      { slug: "demo-netflix", name: "Demo Netflix", short_description: "1 month (demo)", description: "Sample product", price: 18, sale_price: 12, status: "published", type: "simple", category_id: catId("streaming") },
    ];
    await supabaseAdmin.from("products").upsert(products as any, { onConflict: "slug" });

    return { ok: true, categories: categories.length, products: products.length };
  });
