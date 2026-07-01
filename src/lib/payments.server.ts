// Server-only: shared payment callback processing used by the webhook route
// and the dev "simulate gateway" server function. Delegates to the
// process_payment_callback SECURITY DEFINER RPC so it works without a
// service-role key.

export type GatewayCallback = {
  orderNumber: string;
  transactionId: string;
  status: "paid" | "failed";
  gateway: string;
  raw?: Record<string, unknown>;
};

export async function processPaymentCallback(cb: GatewayCallback) {
  const { createServerSupabaseClient } = await import("@/integrations/supabase/server-client");
  const sb: any = createServerSupabaseClient();
  const { data, error } = await sb.rpc("process_payment_callback", {
    _order_number: cb.orderNumber,
    _transaction_id: cb.transactionId,
    _status: cb.status,
    _gateway: cb.gateway,
    _raw: JSON.parse(JSON.stringify(cb.raw ?? {})),
  });
  if (error) throw new Error(error.message);
  const result = data as { ok: boolean; reason?: string } | null;
  if (!result?.ok) return { ok: false as const, reason: result?.reason ?? "unknown" };

  if (cb.status === "paid") {
    try {
      const { data: ord } = await sb.rpc("get_order_basic_by_number", { _order_number: cb.orderNumber });
      const orderId = (ord as any)?.id as string | undefined;
      if (orderId) {
        const { sendPostPaymentEmails } = await import("@/lib/emails/triggers.server");
        await sendPostPaymentEmails(orderId);
      }
    } catch (e) {
      console.error("[emails] post-payment dispatch failed", e);
    }
  }

  return { ok: true as const, result: result as Record<string, unknown> };
}
