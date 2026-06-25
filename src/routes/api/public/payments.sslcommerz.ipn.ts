// SSLCommerz IPN handler.
// SSLCommerz POSTs application/x-www-form-urlencoded with val_id + tran_id +
// status. We MUST re-validate against their validator API before trusting it,
// then delegate to processPaymentCallback() which marks order paid and
// fans out licenses/downloads/emails idempotently.

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/payments/sslcommerz/ipn")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { logPaymentEvent, claimWebhookEvent } = await import("@/lib/payments/logger.server");
        const { validateSslcommerzPayment } = await import("@/lib/payments/sslcommerz.server");
        const { processPaymentCallback } = await import("@/lib/payments.server");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const ip = request.headers.get("x-forwarded-for") ?? request.headers.get("cf-connecting-ip") ?? null;
        const ua = request.headers.get("user-agent") ?? null;

        let formData: Record<string, string> = {};
        try {
          const text = await request.text();
          for (const [k, v] of new URLSearchParams(text)) formData[k] = v;
        } catch {
          return new Response("invalid_body", { status: 400 });
        }

        const tranId = formData["tran_id"];
        const valId = formData["val_id"];
        const status = formData["status"];

        if (!tranId || !valId) {
          await logPaymentEvent({ gateway: "sslcommerz", event_type: "ipn", status: "missing_fields", ip_address: ip, user_agent: ua, request_body: formData });
          return new Response("missing_fields", { status: 400 });
        }

        // Look up order + intent
        const { data: order } = await supabaseAdmin
          .from("orders")
          .select("id, order_number, total, currency, status")
          .eq("order_number", tranId)
          .maybeSingle();

        if (!order) {
          await logPaymentEvent({ gateway: "sslcommerz", event_type: "ipn", order_number: tranId, transaction_id: valId, status: "order_not_found", request_body: formData, ip_address: ip, user_agent: ua });
          return new Response("order_not_found", { status: 404 });
        }

        // Replay protection: val_id is unique per validated transaction.
        const replay = await claimWebhookEvent("sslcommerz", valId, order.id);
        if (replay) {
          await logPaymentEvent({ gateway: "sslcommerz", event_type: "replay", order_id: order.id, order_number: order.order_number, transaction_id: valId, status: "duplicate", request_body: formData, ip_address: ip, user_agent: ua });
          return new Response("replay_ignored", { status: 200 });
        }

        // Determine mode from intent
        const { data: intent } = await supabaseAdmin
          .from("payment_intents")
          .select("id, mode")
          .eq("order_id", order.id)
          .eq("gateway", "sslcommerz")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        const mode: "sandbox" | "live" = intent?.mode === "live" ? "live" : "sandbox";

        // Re-validate against SSLCommerz validator API
        const validation = await validateSslcommerzPayment(valId, mode);

        await logPaymentEvent({
          gateway: "sslcommerz",
          event_type: "validate",
          order_id: order.id,
          order_number: order.order_number,
          payment_intent_id: intent?.id ?? null,
          transaction_id: valId,
          amount: validation.amount ?? null,
          currency: validation.currency ?? null,
          status: validation.status,
          signature_valid: validation.ok,
          request_body: formData,
          response_body: validation.raw,
          ip_address: ip,
          user_agent: ua,
        });

        // Amount tampering check
        if (validation.ok && validation.amount != null && Math.abs(validation.amount - Number(order.total)) > 0.01 && order.currency !== "USD") {
          await logPaymentEvent({ gateway: "sslcommerz", event_type: "error", order_id: order.id, order_number: order.order_number, transaction_id: valId, status: "amount_mismatch", error_message: `expected ${order.total} got ${validation.amount}`, response_body: validation.raw });
          return new Response("amount_mismatch", { status: 400 });
        }

        if (!validation.ok || status === "FAILED" || status === "CANCELLED") {
          await processPaymentCallback({
            orderNumber: order.order_number,
            transactionId: valId,
            status: "failed",
            gateway: "sslcommerz",
            raw: { ipn: formData, validation: validation.raw },
          });
          await supabaseAdmin.from("payment_intents").update({ status: "failed", gateway_payment_id: valId, response_payload: validation.raw }).eq("id", intent?.id ?? "");
          return new Response("failed_recorded", { status: 200 });
        }

        const result = await processPaymentCallback({
          orderNumber: order.order_number,
          transactionId: valId,
          status: "paid",
          gateway: "sslcommerz",
          raw: { ipn: formData, validation: validation.raw },
        });

        await supabaseAdmin.from("payment_intents").update({ status: "paid", gateway_payment_id: valId, response_payload: validation.raw }).eq("id", intent?.id ?? "");
        await logPaymentEvent({ gateway: "sslcommerz", event_type: "success", order_id: order.id, order_number: order.order_number, transaction_id: valId, status: "paid", response_body: result });

        return new Response("ok", { status: 200 });
      },
    },
  },
});
