// bKash Checkout (URL) callback/return.
// The callback query string is NEVER trusted as payment confirmation. We execute
// (or query as fallback) the payment server-side and verify every field before
// marking the order paid.

import { createFileRoute } from "@tanstack/react-router";

async function handle(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const orderNumber = url.searchParams.get("order") ?? "";
  const status = (url.searchParams.get("status") || "").toLowerCase();
  const paymentID = url.searchParams.get("paymentID") ?? "";

  let paid = false;

  try {
    const { logPaymentEvent, claimWebhookEvent } = await import("@/lib/payments/logger.server");
    await logPaymentEvent({
      gateway: "bkash",
      event_type: "redirect",
      order_number: orderNumber || null,
      transaction_id: paymentID || null,
      status: status || "unknown",
      request_body: Object.fromEntries(url.searchParams),
    });

    if (status === "success" && paymentID && orderNumber) {
      const { createServerSupabaseClient } = await import("@/integrations/supabase/server-client");
      const { executeBkashPayment, queryBkashPayment } = await import("@/lib/payments/bkash.server");
      const { processPaymentCallback } = await import("@/lib/payments.server");
      const sb: any = createServerSupabaseClient();

      const { data: ordData } = await sb.rpc("get_order_basic_by_number", { _order_number: orderNumber });
      const ord = ordData as
        | { id: string; order_number: string; total: number; currency: string; status?: string }
        | null;

      if (ord) {
        const { data: intentData } = await sb.rpc("get_latest_payment_intent", {
          _order_id: ord.id,
          _gateway: "bkash",
        });
        const intent = intentData as { mode?: string; gateway_session_id?: string } | null;
        const mode: "sandbox" | "live" = intent?.mode === "live" ? "live" : "sandbox";

        // 1. paymentID must match the stored intent session id
        const intentMatches = intent?.gateway_session_id === paymentID;
        // 2. do not reprocess an already-successful payment
        const replay = await claimWebhookEvent("bkash", paymentID, ord.id);

        if (intentMatches && !replay && ord.status !== "paid") {
          let result = await executeBkashPayment(paymentID, mode);
          if (!result.ok) {
            const q = await queryBkashPayment(paymentID, mode);
            if (q.ok) result = q;
          }

          const amountMatches =
            typeof result.amount === "number" &&
            Math.abs(result.amount - Number(ord.total)) < 0.005;

          const verified =
            result.transactionStatus === "Completed" &&
            result.paymentID === paymentID &&
            result.merchantInvoiceNumber === ord.order_number &&
            amountMatches &&
            result.currency === "BDT";

          if (verified) {
            const cb = await processPaymentCallback({
              orderNumber: ord.order_number,
              transactionId: result.trxID || paymentID,
              status: "paid",
              gateway: "bkash",
              raw: { from: "bkash_callback", execute: result.raw },
            });
            paid = cb.ok;
          } else {
            await logPaymentEvent({
              gateway: "bkash",
              event_type: "verify_failed",
              order_id: ord.id,
              order_number: ord.order_number,
              transaction_id: paymentID,
              status: result.transactionStatus || "unverified",
              response_body: result.raw,
            });
          }
        } else if (ord.status === "paid" || replay) {
          paid = true;
        }
      }
    }
  } catch (e) {
    console.error("[bkash callback]", e);
  }

  const dest = paid
    ? `/thank-you?order=${encodeURIComponent(orderNumber)}`
    : `/pay/${encodeURIComponent(orderNumber)}`;
  return new Response(null, { status: 302, headers: { Location: dest } });
}

export const Route = createFileRoute("/api/public/payments/bkash/callback")({
  server: {
    handlers: {
      GET: ({ request }) => handle(request),
      POST: ({ request }) => handle(request),
    },
  },
});
