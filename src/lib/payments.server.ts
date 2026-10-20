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

export async function processPaymentCallback(cb: GatewayCallback, rpcClient?: any) {
  const sb: any = rpcClient ?? await (async () => {
    const { createServerSupabaseClient } = await import("@/integrations/supabase/server-client");
    return createServerSupabaseClient();
  })();
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
        // Account-only fulfillment: keep every other product workflow untouched.
        try {
          const { data: items, error: itemsError } = await sb
            .from("order_items")
            .select("id, product_id, products!inner(product_type)")
            .eq("order_id", orderId)
            .eq("products.product_type", "account");
          if (itemsError) throw new Error(itemsError.message);
          if ((items ?? []).length > 0) {
            const { error: fulfillmentError } = await sb.rpc("fulfill_account_inventory_for_order", {
              _order_id: orderId,
            });
            if (fulfillmentError) throw new Error(fulfillmentError.message);
          }
        } catch (e) {
          console.error("[account-fulfillment] automatic assignment failed", e);
        }
        const { sendPostPaymentEmails } = await import("@/lib/emails/triggers.server");
        await sendPostPaymentEmails(orderId);
      }
    } catch (e) {
      console.error("[emails] post-payment dispatch failed", e);
    }
  }

  return { ok: true as const, result: result as Record<string, unknown> };
}
