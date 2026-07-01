// Append-only payment audit logger. Uses SECURITY DEFINER RPC so it works
// without a service-role key. Failures never break the payment flow — errors
// are swallowed and printed to console.

export type PaymentLogEntry = {
  gateway: string;
  event_type: string;
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

async function serverClient() {
  const { createServerSupabaseClient } = await import("@/integrations/supabase/server-client");
  return createServerSupabaseClient() as any;
}

export async function logPaymentEvent(entry: PaymentLogEntry): Promise<void> {
  try {
    const sb = await serverClient();
    const payload = {
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
    };
    await sb.rpc("log_payment_event", { _entry: payload });
  } catch (e) {
    console.error("[payment_logs] insert failed", e);
  }
}

/** Returns true if this event was processed before (replay). Otherwise records it. */
export async function claimWebhookEvent(gateway: string, eventId: string, orderId?: string | null): Promise<boolean> {
  try {
    const sb = await serverClient();
    const { data, error } = await sb.rpc("claim_webhook_event", {
      _gateway: gateway,
      _event_id: eventId,
      _order_id: orderId ?? null,
    });
    if (error) {
      console.error("[webhook_events] claim error", error);
      return false;
    }
    return Boolean(data);
  } catch (e) {
    console.error("[webhook_events] claim failed", e);
    return false;
  }
}
