// Append-only payment audit logger. Used by gateway implementations and
// webhook handlers. Failures here must never break the payment flow — log
// errors are swallowed and printed to console.

export type PaymentLogEntry = {
  gateway: string;
  event_type: string; // init | redirect | ipn | validate | success | failed | error | replay
  order_id?: string | null;
  order_number?: string | null;
  payment_intent_id?: string | null;
  transaction_id?: string | null;
  amount?: number | null;
  currency?: string | null;
  status?: string | null;
  signature_valid?: boolean | null;
  ip_address?: string | null;
  user_agent?: string | null;
  request_body?: unknown;
  response_body?: unknown;
  error_message?: string | null;
};

export async function logPaymentEvent(entry: PaymentLogEntry): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("payment_logs").insert({
      gateway: entry.gateway,
      event_type: entry.event_type,
      order_id: entry.order_id ?? null,
      order_number: entry.order_number ?? null,
      payment_intent_id: entry.payment_intent_id ?? null,
      transaction_id: entry.transaction_id ?? null,
      amount: entry.amount ?? null,
      currency: entry.currency ?? null,
      status: entry.status ?? null,
      signature_valid: entry.signature_valid ?? null,
      ip_address: entry.ip_address ?? null,
      user_agent: entry.user_agent ?? null,
      request_body: entry.request_body ? JSON.parse(JSON.stringify(entry.request_body)) : null,
      response_body: entry.response_body ? JSON.parse(JSON.stringify(entry.response_body)) : null,
      error_message: entry.error_message ?? null,
    });
  } catch (e) {
    console.error("[payment_logs] insert failed", e);
  }
}

/** Returns true if this event was processed before (replay). Otherwise records it. */
export async function claimWebhookEvent(gateway: string, eventId: string, orderId?: string | null): Promise<boolean> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("webhook_events")
      .insert({ gateway, event_id: eventId, order_id: orderId ?? null });
    if (error) {
      // Unique violation = replay
      if (error.code === "23505") return true;
      console.error("[webhook_events] insert error", error);
      return false;
    }
    return false;
  } catch (e) {
    console.error("[webhook_events] claim failed", e);
    return false;
  }
}
