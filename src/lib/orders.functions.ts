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

const COUPONS: Record<string, number> = { TOPUP10: 0.1, WELCOME15: 0.15, FLASH25: 0.25 };

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
  const discount = couponCode && COUPONS[couponCode] ? +(subtotal * COUPONS[couponCode]).toFixed(2) : 0;
  const total = +(subtotal - discount).toFixed(2);

  const { data: numRow, error: nErr } = await supabaseAdmin.rpc("generate_order_number");
  if (nErr) throw new Error(nErr.message);
  const orderNumber = numRow as unknown as string;

  const customerName = [input.customer.firstName, input.customer.lastName].filter(Boolean).join(" ").trim() || null;

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
      status: "paid",
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

  const { data: insertedItems, error: iErr } = await supabaseAdmin
    .from("order_items")
    .insert(itemsToInsert.map((it) => ({ ...it, order_id: order.id })))
    .select();
  if (iErr) throw new Error(iErr.message);

  const { error: payErr } = await supabaseAdmin.from("payments").insert({
    order_id: order.id,
    amount: total,
    currency: "USD",
    method: input.paymentMethod,
    status: "paid",
    paid_at: new Date().toISOString(),
  });
  if (payErr) throw new Error(payErr.message);

  await supabaseAdmin.rpc("assign_licenses_for_order", { _order_id: order.id });

  return { orderNumber: order.order_number, orderId: order.id, total, itemCount: insertedItems?.length ?? 0 };
}

export const placeOrderGuestFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => placeSchema.parse(d))
  .handler(async ({ data }) => placeOrderCore(data, null));

export const placeOrderAuthFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => placeSchema.parse(d))
  .handler(async ({ data, context }) => placeOrderCore(data, context.userId));

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
      supabaseAdmin.from("payments").select("*").eq("order_id", order.id),
      supabaseAdmin
        .from("license_assignments")
        .select("id, order_item_id, license_keys(key_value)")
        .eq("order_id", order.id),
    ]);
    return { order, items: items ?? [], payments: payments ?? [], assignments: assignments ?? [] };
  });

export const getMyOrdersFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("orders")
      .select("id, order_number, status, total, currency, created_at, order_items(id, product_name, qty, unit_price, line_total)")
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
