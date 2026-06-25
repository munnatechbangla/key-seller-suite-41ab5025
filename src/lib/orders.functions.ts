import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const itemSchema = z.object({
  slug: z.string(),
  qty: z.number().int().positive(),
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

async function placeOrderCore(input: z.infer<typeof placeSchema>, userId: string | null) {

async function placeOrderCore(input: z.infer<typeof placeSchema>, userId: string | null) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const slugs = input.items.map((i) => i.slug);

  const { data: products, error: pErr } = await supabaseAdmin
    .from("products")
    .select("id, slug, title, regular_price, sale_price")
    .in("slug", slugs);
  if (pErr) throw new Error(pErr.message);
  if (!products || products.length === 0) throw new Error("Products not found");

  let subtotal = 0;
  const itemsToInsert = input.items.map((it) => {
    const p = products.find((x) => x.slug === it.slug);
    if (!p) throw new Error(`Product not found: ${it.slug}`);
    const unit = Number(p.sale_price ?? p.regular_price);
    const line = unit * it.qty;
    subtotal += line;
    return {
      product_id: p.id,
      product_slug: p.slug,
      product_name: p.title,
      unit_price: unit,
      qty: it.qty,
      line_total: line,
    };
  });

  const couponCode = input.couponCode?.trim().toUpperCase() || null;
  let discount = 0;
  let couponId: string | null = null;
  if (couponCode) {
    const productIds = products.map((p) => p.id);
    const { data: vRow } = await supabaseAdmin.rpc("validate_coupon", {
      _code: couponCode,
      _subtotal: subtotal,
      _user_id: userId ?? undefined,
      _email: input.customer.email,
      _product_ids: productIds,
    });
    const v = vRow as { ok: boolean; discount?: number; coupon_id?: string; reason?: string } | null;
    if (!v?.ok) throw new Error(`Coupon invalid: ${v?.reason ?? "unknown"}`);
    discount = Number(v.discount ?? 0);
    couponId = v.coupon_id ?? null;
  }
  const total = +(subtotal - discount).toFixed(2);

  const { data: numRow, error: nErr } = await supabaseAdmin.rpc("generate_order_number");
  if (nErr) throw new Error(nErr.message);
  const orderNumber = numRow as unknown as string;

  const customerName = [input.customer.firstName, input.customer.lastName].filter(Boolean).join(" ").trim() || null;

  // Order + payment are created as PENDING. License keys and downloads are
  // generated only after a verified payment callback via the webhook route.
  const { data: order, error: oErr } = await supabaseAdmin
    .from("orders")
    .insert({
      order_number: orderNumber,
      user_id: userId,
      email: input.customer.email,
      customer_name: customerName,
      phone: input.customer.phone || null,
      country: input.customer.country || null,
      address: input.customer.address || null,
      notes: input.customer.notes || null,
      status: "pending",
      subtotal,
      discount,
      total,
      currency: "USD",
      coupon_code: couponCode,
      payment_method: input.paymentMethod,
    })
    .select()
    .single();
  if (oErr || !order) throw new Error(oErr?.message ?? "Order insert failed");

  const { error: iErr } = await supabaseAdmin
    .from("order_items")
    .insert(itemsToInsert.map((it) => ({ ...it, order_id: order.id })));
  if (iErr) throw new Error(iErr.message);

  const { error: payErr } = await supabaseAdmin.from("payments").insert({
    order_id: order.id,
    amount: total,
    currency: "USD",
    method: input.paymentMethod,
    status: "pending",
  });
  if (payErr) throw new Error(payErr.message);

  if (couponId) {
    await supabaseAdmin.rpc("apply_coupon_usage", {
      _coupon_id: couponId,
      _order_id: order.id,
      _user_id: userId ?? undefined,
      _email: input.customer.email,
      _discount: discount,
      _order_total: total,
    });
  }

  return { orderNumber: order.order_number, orderId: order.id, total, paymentUrl: `/pay/${order.order_number}` };
}

export const placeOrderGuestFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => placeSchema.parse(d))
  .handler(async ({ data }) => placeOrderCore(data, null));

export const placeOrderAuthFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => placeSchema.parse(d))
  .handler(async ({ data, context }) => placeOrderCore(data, context.userId));

// ----- Dev / sandbox: simulate a gateway callback (real gateways post to the webhook) -----
// In production these calls come from SSLCommerz/bKash/Nagad/Stripe/PayPal webhooks
// (see src/routes/api/public/payments.webhook.ts). This server fn exists so the UI
// can drive a full pending -> paid lifecycle while real merchant accounts aren't connected.
export const simulateGatewayPaymentFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        orderNumber: z.string(),
        outcome: z.enum(["paid", "failed"]).default("paid"),
      })
      .parse(d),
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

// ----- Reads -----

export const getOrderByNumberFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ orderNumber: z.string(), email: z.string().email().optional() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin.from("orders").select("*").eq("order_number", data.orderNumber).limit(1);
    if (data.email) q = q.eq("email", data.email);
    const { data: orderRows, error } = await q;
    if (error) throw new Error(error.message);
    const order = orderRows?.[0];
    if (!order) return null;
    const [{ data: items }, { data: payments }, { data: assignments }] = await Promise.all([
      supabaseAdmin.from("order_items").select("*").eq("order_id", order.id),
      supabaseAdmin.from("payments").select("*").eq("order_id", order.id).order("created_at", { ascending: false }),
      supabaseAdmin
        .from("license_assignments")
        .select("id, order_item_id, license_keys(key_value)")
        .eq("order_id", order.id),
    ]);
    const paymentStatus = payments?.[0]?.status ?? "pending";
    return { order, items: items ?? [], payments: payments ?? [], assignments: assignments ?? [], paymentStatus };
  });

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
