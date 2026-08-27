// Server function called from the /pay page. Dispatches to the configured
// gateway, creates a payment_intents row, and returns a redirect URL.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getRequestHost } from "@tanstack/react-start/server";
import { csrfGuard } from "@/lib/security/csrf.server";

const schema = z.object({
  orderNumber: z.string().min(1),
  gateway: z.string().min(1),
});

type PaymentSettingsRow = {
  sslcommerz_enabled?: boolean;
  sslcommerz_mode?: "sandbox" | "live";
  bkash_enabled?: boolean;
  bkash_mode?: "sandbox" | "live";
  stripe_enabled?: boolean;
  stripe_mode?: "sandbox" | "live";
  currency?: string;
};

async function loadPaymentSettings(): Promise<PaymentSettingsRow> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("site_settings")
    .select("value")
    .eq("group_key", "payment")
    .eq("setting_key", "config")
    .maybeSingle();
  return ((data?.value as PaymentSettingsRow) || {});
}

function baseUrlFromRequest(): string {
  const host = getRequestHost();
  const proto = host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https";
  return `${proto}://${host}`;
}

export const initPaymentFn = createServerFn({ method: "POST" })
  .middleware([csrfGuard])
  .inputValidator((d: unknown) => schema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const settings = await loadPaymentSettings();

    const { data: order, error: oErr } = await supabaseAdmin
      .from("orders")
      .select("id, order_number, status, total, currency, email, customer_name, phone, address")
      .eq("order_number", data.orderNumber)
      .maybeSingle();
    if (oErr || !order) throw new Error("Order not found");
    if (order.status === "paid") return { ok: false as const, reason: "already_paid" };

    const baseUrl = baseUrlFromRequest();

    if (data.gateway === "sslcommerz") {
      if (!settings.sslcommerz_enabled) throw new Error("SSLCommerz is disabled");
      const mode: "sandbox" | "live" = settings.sslcommerz_mode === "live" ? "live" : "sandbox";

      const { isSslcommerzConfigured, initSslcommerzSession } = await import("./sslcommerz.server");
      if (!isSslcommerzConfigured(mode)) {
        throw new Error(`SSLCommerz ${mode} credentials not configured`);
      }

      // Get one product name for the gateway form
      const { data: items } = await supabaseAdmin
        .from("order_items")
        .select("product_name")
        .eq("order_id", order.id)
        .limit(3);
      const productName = (items ?? []).map((i) => i.product_name).join(", ") || `Order ${order.order_number}`;

      const result = await initSslcommerzSession({
        orderId: order.id,
        orderNumber: order.order_number,
        amount: Number(order.total),
        currency: order.currency === "USD" ? "BDT" : (order.currency || "BDT"),
        customerName: order.customer_name || order.email,
        customerEmail: order.email,
        customerPhone: order.phone || undefined,
        customerAddress: order.address || undefined,
        productName,
        baseUrl,
        mode,
      });

      if (!result.ok) {
        await (supabaseAdmin as any).from("payment_intents").insert({
          order_id: order.id,
          order_number: order.order_number,
          gateway: "sslcommerz",
          mode,
          amount: Number(order.total),
          currency: order.currency,
          status: "failed",
          response_payload: { reason: result.reason, raw: result.raw ?? {} } as never,
        });
        throw new Error(result.reason);
      }

      await (supabaseAdmin as any).from("payment_intents").insert({
        order_id: order.id,
        order_number: order.order_number,
        gateway: "sslcommerz",
        mode,
        gateway_session_id: result.sessionKey,
        redirect_url: result.gatewayUrl,
        amount: Number(order.total),
        currency: order.currency,
        status: "redirected",
        response_payload: result.raw as never,
      });

      return { ok: true as const, gateway: "sslcommerz", redirectUrl: result.gatewayUrl };
    }

    // ---- Custom Auto runtime adapter (no-code gateways) ----
    const { data: gw, error: gwErr } = await supabaseAdmin
      .from("payment_gateways")
      .select("id, slug, type, is_enabled, mode, config")
      .eq("slug", data.gateway)
      .maybeSingle();
    if (gwErr) throw new Error(gwErr.message);
    if (!gw) throw new Error(`Gateway not found: ${data.gateway}`);
    if (!gw.is_enabled) throw new Error(`Gateway disabled: ${data.gateway}`);

    if (gw.type === "custom_auto") {
      const { createCustomAutoSession } = await import("./custom-auto.server");
      const { data: items } = await supabaseAdmin
        .from("order_items").select("product_name").eq("order_id", order.id).limit(3);
      const productName = (items ?? []).map((i) => i.product_name).join(", ") || `Order ${order.order_number}`;

      const result = await createCustomAutoSession({
        gatewaySlug: gw.slug,
        config: (gw.config as Record<string, unknown>) ?? {},
        orderId: order.id,
        orderNumber: order.order_number,
        amount: Number(order.total),
        currency: order.currency,
        customerName: order.customer_name,
        customerEmail: order.email,
        customerPhone: order.phone,
        productName,
        baseUrl,
      });

      await (supabaseAdmin as any).from("payment_intents").insert({
        order_id: order.id,
        order_number: order.order_number,
        gateway: gw.slug,
        mode: gw.mode,
        gateway_session_id: result.ok ? result.transactionId : null,
        redirect_url: result.ok ? result.redirectUrl : null,
        amount: Number(order.total),
        currency: order.currency,
        status: result.ok ? "redirected" : "failed",
        response_payload: (result.ok ? result.raw : { reason: result.reason, raw: result.raw ?? {} }) as never,
      });

      if (!result.ok) throw new Error(result.reason);
      return { ok: true as const, gateway: gw.slug, redirectUrl: result.redirectUrl };
    }

    throw new Error(`Gateway not implemented: ${data.gateway}`);
  });
