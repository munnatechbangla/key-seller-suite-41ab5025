import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { csrfGuard } from "@/lib/security/csrf.server";

const itemSchema = z.object({
  slug: z.string(),
  qty: z.number().int().positive(),
  variant_id: z.string().uuid().nullable().optional(),
  selected_attributes: z.record(z.string(), z.any()).optional(),
});

const customerSchema = z.object({
  email: z.string().email(),
  firstName: z.string().optional().default(""),
  lastName: z.string().optional().default(""),
  phone: z.string().optional().default(""),
  country: z.string().optional().default(""),
  address: z.string().optional().default(""),
  notes: z.string().optional().default(""),
});

const placeSchema = z.object({
  items: z.array(itemSchema).min(1),
  customer: customerSchema,
  paymentMethod: z.string().min(1),
  couponCode: z.string().nullable().optional(),
});

async function placeOrderViaRpc(input: z.infer<typeof placeSchema>, sb: any) {
  const { data, error } = await sb.rpc("place_order", {
    _items: input.items as any,
    _customer: input.customer as any,
    _payment_method: input.paymentMethod,
    _coupon_code: input.couponCode ?? null,
  });
  if (error) throw new Error(error.message);
  const result = data as { ok: boolean; order_id: string; order_number: string; total: number; reason?: string } | null;
  if (!result?.ok) throw new Error(result?.reason ?? "order_failed");

  try {
    const { sendOrderConfirmation } = await import("@/lib/emails/triggers.server");
    await sendOrderConfirmation(result.order_id);
  } catch (e) {
    console.error("[emails] order confirmation failed", e);
  }

  return {
    orderNumber: result.order_number,
    orderId: result.order_id,
    total: result.total,
    paymentUrl: `/pay/${result.order_number}`,
  };
}

export const placeOrderGuestFn = createServerFn({ method: "POST" })
  .middleware([csrfGuard])
  .inputValidator((d: unknown) => placeSchema.parse(d))
  .handler(async ({ data }) => {
    const { createServerSupabaseClient } = await import("@/integrations/supabase/server-client");
    return placeOrderViaRpc(data, createServerSupabaseClient());
  });

export const placeOrderAuthFn = createServerFn({ method: "POST" })
  .middleware([csrfGuard, requireSupabaseAuth])
  .inputValidator((d: unknown) => placeSchema.parse(d))
  .handler(async ({ data, context }) => placeOrderViaRpc(data, context.supabase));

// Dev/sandbox simulate: real gateways post to the webhook route.
export const simulateGatewayPaymentFn = createServerFn({ method: "POST" })
  .middleware([csrfGuard])
  .inputValidator((d: unknown) =>
    z.object({ orderNumber: z.string(), outcome: z.enum(["paid", "failed"]).default("paid") }).parse(d),
  )
  .handler(async ({ data }) => {
    const { processPaymentCallback } = await import("@/lib/payments.server");
    const txn = `SIM-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const r = await processPaymentCallback({
      orderNumber: data.orderNumber,
      transactionId: txn,
      status: data.outcome,
      gateway: "sandbox",
      raw: { simulated: true, at: new Date().toISOString() },
    });
    return { ok: r.ok, transactionId: txn, outcome: data.outcome };
  });

async function runOrderSummary(sb: any, orderNumber: string, email?: string) {
  const { data: rpcData, error } = await sb.rpc("get_order_summary_by_number", {
    _order_number: orderNumber,
    _email: email ?? undefined,
  });
  if (error) throw new Error(error.message);
  if (!rpcData) return null;
  const r = rpcData as {
    order: any;
    items: any[];
    payments: any[];
    assignments: any[];
    paymentStatus: string;
  };
  return {
    order: r.order,
    items: r.items ?? [],
    payments: r.payments ?? [],
    assignments: r.assignments ?? [],
    paymentStatus: r.paymentStatus ?? "pending",
  };
}

// Public / guest fetch — used when no user session is available.
export const getOrderByNumberFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z.object({ orderNumber: z.string(), email: z.string().email().optional() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { createServerSupabaseClient } = await import("@/integrations/supabase/server-client");
    return runOrderSummary(createServerSupabaseClient(), data.orderNumber, data.email);
  });

// Authenticated variant — forwards the user's bearer so auth.uid() matches
// orders.user_id inside get_order_summary_by_number's ownership check.
export const getMyOrderByNumberFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ orderNumber: z.string(), email: z.string().email().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => runOrderSummary(context.supabase, data.orderNumber, data.email));

export const getMyOrdersFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("orders")
      .select("id, order_number, status, total, currency, created_at, order_items(id, product_name, qty, unit_price, line_total), payments(status)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getMyDownloadsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("downloads")
      .select("id, file_url, download_count, max_downloads, expires_at, created_at, order_id, order_items(product_name, product_slug)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getMyLicensesFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("license_assignments")
      .select("id, assigned_at, order_id, order_items(product_name, product_slug), license_keys(key_value, status)")
      .order("assigned_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });
