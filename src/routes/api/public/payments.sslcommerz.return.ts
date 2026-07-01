// Customer-facing return URL from SSLCommerz hosted checkout.
// SSLCommerz redirects the browser here with form-encoded body. We DO NOT
// trust this for fulfillment — the IPN handler at /ipn is the source of
// truth. This handler just guides the user to the right page.

import { createFileRoute } from "@tanstack/react-router";

async function handle(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const type = url.searchParams.get("type") || "success";
  const orderFromQuery = url.searchParams.get("order");

  let order = orderFromQuery;
  try {
    if (request.method === "POST") {
      const text = await request.text();
      const form = new URLSearchParams(text);
      order = order || form.get("tran_id");
      const valId = form.get("val_id");
      const { logPaymentEvent, claimWebhookEvent } = await import("@/lib/payments/logger.server");
      await logPaymentEvent({
        gateway: "sslcommerz",
        event_type: "redirect",
        order_number: order ?? null,
        transaction_id: valId ?? null,
        status: type,
        request_body: Object.fromEntries(form),
      });

      if (valId && (type === "success" || type === "fail")) {
        const { createServerSupabaseClient } = await import("@/integrations/supabase/server-client");
        const { validateSslcommerzPayment } = await import("@/lib/payments/sslcommerz.server");
        const { processPaymentCallback } = await import("@/lib/payments.server");
        const sb: any = createServerSupabaseClient();

        const { data: ordData } = await sb.rpc("get_order_basic_by_number", { _order_number: order ?? "" });
        const ord = ordData as { id: string; order_number: string; total: number; currency: string } | null;
        if (ord) {
          const { data: intentData } = await sb.rpc("get_latest_payment_intent", { _order_id: ord.id, _gateway: "sslcommerz" });
          const intent = intentData as { mode?: string } | null;
          const mode: "sandbox" | "live" = intent?.mode === "live" ? "live" : "sandbox";

          const replay = await claimWebhookEvent("sslcommerz", valId, ord.id);
          if (!replay) {
            const v = await validateSslcommerzPayment(valId, mode);
            await processPaymentCallback({
              orderNumber: ord.order_number,
              transactionId: valId,
              status: v.ok ? "paid" : "failed",
              gateway: "sslcommerz",
              raw: { from: "return_url", validation: v.raw },
            });
          }
        }
      }
  } catch (e) {
    console.error("[sslcommerz return]", e);
  }

  const dest = (type === "cancel" || type === "fail")
    ? `/pay/${encodeURIComponent(order ?? "")}`
    : `/thank-you?order=${encodeURIComponent(order ?? "")}`;
  return new Response(null, { status: 302, headers: { Location: dest } });
}

export const Route = createFileRoute("/api/public/payments/sslcommerz/return")({
  server: {
    handlers: {
      GET: ({ request }) => handle(request),
      POST: ({ request }) => handle(request),
    },
  },
});
