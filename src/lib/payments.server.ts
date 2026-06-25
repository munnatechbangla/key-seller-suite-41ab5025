// Server-only: shared payment callback processing used by the webhook route
// and the dev "simulate gateway" server function. Both code paths must end up
// here so verification, idempotency, and license delivery stay consistent.

import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type GatewayCallback = {
  orderNumber: string;
  transactionId: string;
  status: "paid" | "failed";
  gateway: string;
  raw?: Record<string, unknown>;
};

export async function processPaymentCallback(cb: GatewayCallback) {
  const { data: orderRows, error: oErr } = await supabaseAdmin
    .from("orders")
    .select("id, status, total, currency, payment_method")
    .eq("order_number", cb.orderNumber)
    .limit(1);
  if (oErr) throw new Error(oErr.message);
  const order = orderRows?.[0];
  if (!order) return { ok: false as const, reason: "order_not_found" };

  const gatewayPayload = JSON.parse(JSON.stringify({ gateway: cb.gateway, txn: cb.transactionId, raw: cb.raw ?? {} }));

  if (cb.status === "paid") {
    const { data, error } = await supabaseAdmin.rpc("mark_order_paid", {
      _order_id: order.id,
      _transaction_id: cb.transactionId,
      _gateway_response: gatewayPayload,
    });
    if (error) throw new Error(error.message);
    // Fire-and-forget transactional emails (queued; sent only when sender domain is configured).
    try {
      const { sendPostPaymentEmails } = await import("@/lib/emails/triggers.server");
      await sendPostPaymentEmails(order.id);
    } catch (e) {
      console.error("[emails] post-payment dispatch failed", e);
    }
    return { ok: true as const, result: data as Record<string, unknown> };
  }

  const { data, error } = await supabaseAdmin.rpc("mark_order_failed", {
    _order_id: order.id,
    _reason: `gateway:${cb.gateway}`,
    _gateway_response: gatewayPayload,
  });
  if (error) throw new Error(error.message);
  return { ok: true as const, result: data as Record<string, unknown> };
}
