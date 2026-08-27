// Admin payment dashboard server functions: logs feed + gateway status.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }> }, userId: string) {
  const { data, error } = await (supabase as any).rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error || !data) throw new Error("Forbidden");
}

export const listPaymentLogsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      gateway: z.string().optional(),
      status: z.string().optional(),
      eventType: z.string().optional(),
      limit: z.number().int().min(1).max(200).default(100),
    }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin((context.supabase as any) as never, context.userId);
    let q = (context.supabase as any)
      .from("payment_logs")
      .select("id, gateway, event_type, order_number, transaction_id, amount, currency, status, signature_valid, ip_address, error_message, created_at, request_body, response_body")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.gateway && data.gateway !== "all") q = q.eq("gateway", data.gateway);
    if (data.status && data.status !== "all") q = q.eq("status", data.status);
    if (data.eventType && data.eventType !== "all") q = q.eq("event_type", data.eventType);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { logs: rows ?? [] };
  });

export const gatewayStatusFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin((context.supabase as any) as never, context.userId);

    const { data: settingRow } = await (context.supabase as any)
      .from("site_settings").select("value").eq("group_key", "payment").eq("setting_key", "config").maybeSingle();
    const cfg = (settingRow?.value as Record<string, unknown>) ?? {};

    const gateways = [
      { id: "sslcommerz", label: "SSLCommerz", requiredSecrets: ["SSLCOMMERZ_STORE_ID", "SSLCOMMERZ_STORE_PASSWORD"] },
      { id: "bkash",      label: "bKash",      requiredSecrets: ["BKASH_APP_KEY", "BKASH_APP_SECRET", "BKASH_USERNAME", "BKASH_PASSWORD"] },
      { id: "stripe",     label: "Stripe",     requiredSecrets: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"] },
      { id: "nagad",      label: "Nagad",      requiredSecrets: ["NAGAD_MERCHANT_ID", "NAGAD_MERCHANT_PRIVATE_KEY", "NAGAD_PG_PUBLIC_KEY"] },
      { id: "paypal",     label: "PayPal",     requiredSecrets: ["PAYPAL_CLIENT_ID", "PAYPAL_CLIENT_SECRET"] },
    ];

    const status = gateways.map((g) => {
      const enabled = Boolean(cfg[`${g.id}_enabled`]);
      const mode = (cfg[`${g.id}_mode`] as string) || "sandbox";
      const secretsPresent = g.requiredSecrets.map((name) => ({ name, set: Boolean(process.env[name]) }));
      const ready = enabled && secretsPresent.every((s) => s.set);
      return { ...g, enabled, mode, secretsPresent, ready };
    });

    // Recent stats (last 24h)
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recent } = await (context.supabase as any)
      .from("payment_logs").select("gateway, event_type, status").gte("created_at", since);
    const stats: Record<string, { success: number; failed: number; total: number }> = {};
    for (const g of gateways) stats[g.id] = { success: 0, failed: 0, total: 0 };
    for (const r of recent ?? []) {
      const k = r.gateway;
      if (!stats[k]) stats[k] = { success: 0, failed: 0, total: 0 };
      stats[k].total++;
      if (r.event_type === "success") stats[k].success++;
      if (r.event_type === "failed" || r.status === "failed") stats[k].failed++;
    }

    return { gateways: status, stats };
  });

// ---------- Custom Auto: test connection + per-gateway health ----------

export const testGatewayConnectionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin((context.supabase as any) as never, context.userId);
    const { data: gw, error } = await (context.supabase as any)
      .from("payment_gateways").select("slug, type, config").eq("id", data.id).single();
    if (error) throw new Error(error.message);
    if (gw.type !== "custom_auto") return { ok: false, message: "Test only supported for custom_auto gateways", latencyMs: 0 };
    const { testCustomAutoConnection } = await import("./custom-auto.server");
    return testCustomAutoConnection({ gatewaySlug: gw.slug, config: (gw.config as Record<string, unknown>) ?? {} });
  });

export const getGatewayHealthFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ slug: z.string().min(1), limit: z.number().int().min(1).max(50).default(10) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin((context.supabase as any) as never, context.userId);
    const { data: logs } = await (context.supabase as any)
      .from("payment_logs")
      .select("id, event_type, status, transaction_id, order_number, signature_valid, error_message, created_at, request_body, response_body")
      .eq("gateway", data.slug)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    const list = logs ?? [];
    const lastSuccess = list.find((l) => l.status === "ok" || l.event_type === "success") ?? null;
    const lastFailure = list.find((l) => l.status === "failed" || l.event_type === "error" || l.event_type === "failed") ?? null;
    return { logs: list, lastSuccess, lastFailure };
  });
