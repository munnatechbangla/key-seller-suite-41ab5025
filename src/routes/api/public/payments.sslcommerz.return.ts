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
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { validateSslcommerzPayment } = await import("@/lib/payments/sslcommerz.server");
        const { processPaymentCallback } = await import("@/lib/payments.server");

        const { data: ord } = await supabaseAdmin
          .from("orders").select("id, order_number, total, currency").eq("order_number", order ?? "").maybeSingle();
        if (ord) {
          const { data: intent } = await supabaseAdmin
            .from("payment_intents").select("mode").eq("order_id", ord.id).eq("gateway", "sslcommerz").order("created_at", { ascending: false }).limit(1).maybeSingle();
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
