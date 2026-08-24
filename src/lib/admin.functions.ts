import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

// ---------- KPIs ----------
export const adminGetKpisFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const sb = context.supabase;
    const [revenue, ordersCount, customers, productsCount, paidOrders, allOrders] = await Promise.all([
      sb.from("orders").select("total").eq("status", "paid"),
      sb.from("orders").select("id", { count: "exact", head: true }),
      sb.from("profiles").select("id", { count: "exact", head: true }),
      sb.from("products").select("id", { count: "exact", head: true }),
      sb.from("orders").select("id", { count: "exact", head: true }).eq("status", "paid"),
      sb.from("orders").select("id", { count: "exact", head: true }),
    ]);
    const totalRevenue = (revenue.data ?? []).reduce((s: number, r: any) => s + Number(r.total ?? 0), 0);
    const conversion = allOrders.count ? Math.round(((paidOrders.count ?? 0) / allOrders.count) * 1000) / 10 : 0;
    return {
      totalRevenue,
      orders: ordersCount.count ?? 0,
      customers: customers.count ?? 0,
      products: productsCount.count ?? 0,
      conversion,
    };
  });

// ---------- Products ----------
export const adminListProductsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const baseSelect = "id, title, slug, short_description, description, thumbnail_url, regular_price, sale_price, status, stock_status, is_featured, sales_count, created_at, delivery_type, visibility, external_url, is_digital, is_license_key, category_id";
    
    // Try with SMM columns first
    let { data, error } = await context.supabase
      .from("products")
      .select(`${baseSelect}, product_type, smm_config`)
      .order("created_at", { ascending: false });
    
    if (error && (error.code === "42703" || error.message.includes("smm_config") || error.message.includes("product_type"))) {
      const retry = await context.supabase
        .from("products")
        .select(baseSelect)
        .order("created_at", { ascending: false });
      
      data = (retry.data ?? []).map(r => ({
        ...r,
        product_type: null,
        smm_config: null
      })) as any;
      error = retry.error;
    }

    if (error) throw new Error(error.message);
    return data ?? [];
  });

const productTypeEnum = z.enum([
  "downloadable", "license_key", "subscription", "account", "external", "manual", "smm_service",
]);
const deliveryTypeEnum = z.enum([
  "download", "license_key", "account", "manual", "external_url", "smm_fulfillment",
]);

const productVisibilityEnum = z.enum(["public", "members_only", "hidden"]);
const productStatusEnum = z.enum(["draft", "published", "private", "archived"]);

const productSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1),
  slug: z.string().min(1),
  short_description: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  regular_price: z.number().nonnegative(),
  sale_price: z.number().nonnegative().nullable().optional(),
  thumbnail_url: z.string().nullable().optional(),
  status: productStatusEnum.default("published"),
  is_featured: z.boolean().optional(),
  is_digital: z.boolean().optional(),
  is_license_key: z.boolean().optional(),
  product_type: productTypeEnum.nullable().optional(),
  delivery_type: deliveryTypeEnum.nullable().optional(),
  visibility: productVisibilityEnum.nullable().optional(),
  external_url: z.string().nullable().optional(),
  category_id: z.string().uuid().nullable().optional(),
  smm_config: z.object({
    platform: z.string(),
    service_type: z.string(),
    min_quantity: z.number().gt(0),
    max_quantity: z.number().nonnegative(),
    quantity_step: z.number().gt(0),
    pricing_mode: z.enum(["per_unit", "per_1000", "quantity_tier"]),
    price: z.number().nonnegative(),
    tiers: z.array(z.object({
      min: z.number().nonnegative(),
      price: z.number().nonnegative(),
    })).optional().nullable(),
  }).nullable().optional(),

});

export const adminUpsertProductFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => productSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const payload: any = { ...data };
    if (payload.visibility == null) delete payload.visibility;
    if (payload.product_type == null) delete payload.product_type;
    if (payload.delivery_type == null) delete payload.delivery_type;
    if (payload.category_id === undefined) delete payload.category_id;
    if (payload.id) {
      const { error } = await context.supabase.from("products").update(payload).eq("id", payload.id);
      if (error) throw new Error(error.message);
      return { ok: true, id: payload.id };
    }
    const { data: row, error } = await context.supabase.from("products").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    return { ok: true, id: row.id };
  });

export const adminDeleteProductFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("products").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Orders ----------
export const adminListOrdersFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ status: z.string().optional(), search: z.string().optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const selectWithSmm = "id, order_number, email, customer_name, total, currency, status, payment_method, created_at, order_items(*, smm_fulfillment)";
    const selectWithoutSmm = "id, order_number, email, customer_name, total, currency, status, payment_method, created_at, order_items(*)";

    const fetchOrders = async (select: string) => {
      let q = context.supabase
        .from("orders")
        .select(select)
        .order("created_at", { ascending: false })
        .limit(200);
      if (data.status) q = q.eq("status", data.status as any);
      if (data.search) q = q.or(`order_number.ilike.%${data.search}%,email.ilike.%${data.search}%`);
      return q;
    };

    let { data: rows, error } = await fetchOrders(selectWithSmm);
    
    if (error && (error.code === "42703" || error.message.includes("smm_fulfillment"))) {
      const retry = await fetchOrders(selectWithoutSmm);
      rows = retry.data;
      error = retry.error;
    }
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const adminUpdateOrderStatusFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        orderId: z.string().uuid(),
        status: z.enum(["pending", "paid", "processing", "completed", "cancelled", "refunded", "failed"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const status = data.status as
      | "pending" | "paid" | "processing" | "completed" | "cancelled" | "refunded" | "failed";
    await assertAdmin(context);
    const { error } = await context.supabase.from("orders").update({ status: data.status }).eq("id", data.orderId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Customers ----------
export const adminListCustomersFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data: profiles, error } = await context.supabase
      .from("profiles")
      .select("id, email, full_name, avatar_url, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    // Aggregate order counts
    const ids = (profiles ?? []).map((p: any) => p.id);
    let stats: Record<string, { orders: number; spent: number }> = {};
    if (ids.length) {
      const { data: orders } = await context.supabase
        .from("orders")
        .select("user_id, total, status")
        .in("user_id", ids);
      for (const o of orders ?? []) {
        const k = o.user_id as string;
        if (!stats[k]) stats[k] = { orders: 0, spent: 0 };
        stats[k].orders += 1;
        if (o.status === "paid") stats[k].spent += Number(o.total ?? 0);
      }
    }
    return (profiles ?? []).map((p: any) => ({ ...p, ...(stats[p.id] ?? { orders: 0, spent: 0 }) }));
  });

// ---------- Licenses ----------
export const adminListLicensePoolsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data: pools, error } = await context.supabase
      .from("license_pools")
      .select("id, product_id, name, created_at, products(title, slug)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const ids = (pools ?? []).map((p: any) => p.id);
    const stats: Record<string, { total: number; available: number; assigned: number; revoked: number }> = {};
    if (ids.length) {
      const { data: keys } = await context.supabase
        .from("license_keys")
        .select("pool_id, status")
        .in("pool_id", ids);
      for (const k of keys ?? []) {
        const p = k.pool_id as string;
        if (!stats[p]) stats[p] = { total: 0, available: 0, assigned: 0, revoked: 0 };
        stats[p].total += 1;
        if (k.status === "available") stats[p].available += 1;
        else if (k.status === "assigned") stats[p].assigned += 1;
        else if (k.status === "revoked") stats[p].revoked += 1;
      }
    }
    return (pools ?? []).map((p: any) => ({ ...p, stats: stats[p.id] ?? { total: 0, available: 0, assigned: 0, revoked: 0 } }));
  });

export const adminCreatePoolFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ product_id: z.string().uuid(), name: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: row, error } = await context.supabase
      .from("license_pools")
      .insert({ product_id: data.product_id, name: data.name })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: row.id };
  });

export const adminImportLicenseKeysFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ pool_id: z.string().uuid(), product_id: z.string().uuid(), keys: z.array(z.string().min(1)).min(1) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const rows = data.keys.map((k) => ({
      pool_id: data.pool_id,
      product_id: data.product_id,
      key_value: k.trim(),
      status: "available" as const,
    }));
    const { error, count } = await context.supabase.from("license_keys").insert(rows, { count: "exact" });
    if (error) throw new Error(error.message);
    return { ok: true, inserted: count ?? rows.length };
  });

// ---------- Product Downloads ----------
export const adminListProductDownloadsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ product_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: rows, error } = await (context.supabase as any)
      .from("product_downloads")
      .select("id, product_id, file_name, file_url, version, file_size, sort_order, created_at")
      .eq("product_id", data.product_id)
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const downloadSchema = z.object({
  id: z.string().uuid().optional(),
  product_id: z.string().uuid(),
  file_name: z.string().min(1),
  file_url: z.string().min(1),
  version: z.string().nullable().optional(),
  file_size: z.number().int().nonnegative().nullable().optional(),
  sort_order: z.number().int().optional(),
});

export const adminUpsertProductDownloadFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => downloadSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sb = context.supabase as any;
    if (data.id) {
      const { error } = await sb.from("product_downloads").update(data).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    }
    const { data: row, error } = await sb.from("product_downloads").insert(data).select("id").single();
    if (error) throw new Error(error.message);
    return { ok: true, id: row.id };
  });

export const adminDeleteProductDownloadFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await (context.supabase as any).from("product_downloads").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Product Variations ----------
export const adminListVariationsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ product_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: rows, error } = await (context.supabase as any)
      .from("product_variations")
      .select("id, product_id, name, sku, price, sale_price, compare_price, stock, status, sort_order")
      .eq("product_id", data.product_id)
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const variationSchema = z.object({
  id: z.string().uuid().optional(),
  product_id: z.string().uuid(),
  name: z.string().min(1),
  sku: z.string().nullable().optional(),
  price: z.number().nonnegative(),
  compare_price: z.number().nonnegative().nullable().optional(),
  stock: z.number().int().nullable().optional(),
  status: z.enum(["active", "inactive"]).optional(),
  sort_order: z.number().int().optional(),
});

export const adminUpsertVariationFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => variationSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sb = context.supabase as any;
    if (data.id) {
      const { error } = await sb.from("product_variations").update(data).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    }
    const { data: row, error } = await sb.from("product_variations").insert(data).select("id").single();
    if (error) throw new Error(error.message);
    return { ok: true, id: row.id };
  });

export const adminDeleteVariationFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await (context.supabase as any).from("product_variations").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Product Images (gallery) ----------
export const adminListProductImagesFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ product_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: rows, error } = await (context.supabase as any)
      .from("product_images")
      .select("id, product_id, url, alt, sort_order, is_primary")
      .eq("product_id", data.product_id)
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const imageSchema = z.object({
  id: z.string().uuid().optional(),
  product_id: z.string().uuid(),
  url: z.string().min(1),
  alt: z.string().nullable().optional(),
  sort_order: z.number().int().optional(),
  is_primary: z.boolean().optional(),
});

export const adminUpsertProductImageFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => imageSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sb = context.supabase as any;
    if (data.is_primary) {
      await sb.from("product_images").update({ is_primary: false }).eq("product_id", data.product_id);
    }
    if (data.id) {
      const { error } = await sb.from("product_images").update(data).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    }
    const { data: row, error } = await sb.from("product_images").insert(data).select("id").single();
    if (error) throw new Error(error.message);
    return { ok: true, id: row.id };
  });

export const adminReorderProductImagesFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ items: z.array(z.object({ id: z.string().uuid(), sort_order: z.number().int() })) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sb = context.supabase as any;
    for (const it of data.items) {
      const { error } = await sb.from("product_images").update({ sort_order: it.sort_order }).eq("id", it.id);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const adminDeleteProductImageFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await (context.supabase as any).from("product_images").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Manual License Assignment ----------
// Phase 1.1 — lets admins hand-pick a license key for an order item that
// was not (or could not be) auto-assigned. Extends the existing workflow;
// does not modify subscriptions or auto-assignment.

const LICENSE_ASSIGNABLE_ORDER_STATUSES = ["paid", "processing", "completed"] as const;

function isLicenseProduct(p: { product_type?: string | null; delivery_type?: string | null; is_license_key?: boolean | null } | null | undefined) {
  if (!p) return false;
  return (
    p.product_type === "license_key" ||
    p.delivery_type === "license_key" ||
    !!p.is_license_key
  );
}

export const adminListAssignableLicenseItemsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ orderId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sb = context.supabase as any;

    const { data: order, error: oErr } = await sb
      .from("orders")
      .select("id, order_number, status, user_id, email")
      .eq("id", data.orderId)
      .maybeSingle();
    if (oErr) throw new Error(oErr.message);
    if (!order) throw new Error("Order not found");

    const paid = (LICENSE_ASSIGNABLE_ORDER_STATUSES as readonly string[]).includes(order.status);

    const { data: items, error: iErr } = await sb
      .from("order_items")
      .select("id, product_id, variation_id, product_name, quantity, license_pool_id_snapshot, products(product_type, delivery_type, is_license_key)")
      .eq("order_id", data.orderId);
    if (iErr) throw new Error(iErr.message);

    const licenseItems = (items ?? []).filter((it: any) => isLicenseProduct(it.products));
    const itemIds = licenseItems.map((i: any) => i.id);
    const assignmentsById: Record<string, any[]> = {};
    if (itemIds.length) {
      const { data: existing, error: aErr } = await sb
        .from("license_assignments")
        .select("id, order_item_id, revoked_at, assigned_at, license_key_id, license_keys(key_value)")
        .in("order_item_id", itemIds);
      if (aErr) throw new Error(aErr.message);
      for (const a of existing ?? []) {
        (assignmentsById[a.order_item_id] ||= []).push(a);
      }
    }

    return {
      order: { id: order.id, order_number: order.order_number, status: order.status, paid },
      items: licenseItems.map((it: any) => {
        const all = assignmentsById[it.id] ?? [];
        const active = all.filter((a) => !a.revoked_at);
        const qty = Number(it.quantity ?? 1);
        return {
          order_item_id: it.id,
          product_id: it.product_id,
          variation_id: it.variation_id,
          product_name: it.product_name,
          quantity: qty,
          license_pool_id_snapshot: it.license_pool_id_snapshot ?? null,
          assigned_count: active.length,
          remaining: Math.max(0, qty - active.length),
          assignments: all,
          can_assign: paid && active.length < qty,
        };
      }),
    };
  });

export const adminListAvailableLicenseKeysFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      productId: z.string().uuid(),
      poolId: z.string().uuid().nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    let q = (context.supabase as any)
      .from("license_keys")
      .select("id, key_value, pool_id, product_id, status, created_at, license_pools(name)")
      .eq("status", "available")
      .eq("product_id", data.productId)
      .order("created_at", { ascending: true })
      .limit(500);
    if (data.poolId) q = q.eq("pool_id", data.poolId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const adminAssignLicenseKeyFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      orderItemId: z.string().uuid(),
      licenseKeyId: z.string().uuid(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sb = context.supabase as any;

    // 1) Load order item + parent order.
    const { data: item, error: iErr } = await sb
      .from("order_items")
      .select("id, order_id, product_id, quantity, license_pool_id_snapshot, orders(status, user_id, email), products(product_type, delivery_type, is_license_key)")
      .eq("id", data.orderItemId)
      .maybeSingle();
    if (iErr) throw new Error(iErr.message);
    if (!item) throw new Error("Order item not found");
    if (!isLicenseProduct(item.products)) throw new Error("Item is not a license product");

    const orderStatus = item.orders?.status;
    if (!(LICENSE_ASSIGNABLE_ORDER_STATUSES as readonly string[]).includes(orderStatus)) {
      throw new Error("Order must be paid before a license can be assigned");
    }

    // 2) Enforce quantity cap using existing active assignments.
    const { count: existingCount, error: cErr } = await sb
      .from("license_assignments")
      .select("id", { count: "exact", head: true })
      .eq("order_item_id", data.orderItemId)
      .is("revoked_at", null);
    if (cErr) throw new Error(cErr.message);
    const qty = Number(item.quantity ?? 1);
    if ((existingCount ?? 0) >= qty) {
      throw new Error("This order item already has all licenses assigned");
    }

    // 3) Validate the license key.
    const { data: key, error: kErr } = await sb
      .from("license_keys")
      .select("id, product_id, pool_id, status")
      .eq("id", data.licenseKeyId)
      .maybeSingle();
    if (kErr) throw new Error(kErr.message);
    if (!key) throw new Error("License key not found");
    if (key.status === "revoked") throw new Error("Cannot assign a revoked key");
    if (key.status === "assigned") throw new Error("Key is already assigned");
    if (key.status !== "available") throw new Error("Key is not available");
    if (key.product_id !== item.product_id) {
      throw new Error("Key belongs to a different product");
    }
    if (item.license_pool_id_snapshot && key.pool_id !== item.license_pool_id_snapshot) {
      throw new Error("Key belongs to a different pool than this order item");
    }

    // 4) Claim the key + write the assignment via the privileged client
    //    (license_assignments has no admin INSERT policy).
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: claimed, error: uErr } = await supabaseAdmin
      .from("license_keys")
      .update({ status: "assigned" })
      .eq("id", key.id)
      .eq("status", "available")
      .select("id")
      .maybeSingle();
    if (uErr) throw new Error(uErr.message);
    if (!claimed) throw new Error("Key was just claimed by another process");

    const { error: aErr } = await supabaseAdmin.from("license_assignments").insert({
      order_item_id: data.orderItemId,
      order_id: item.order_id,
      license_key_id: key.id,
      user_id: item.orders?.user_id ?? null,
    });
    if (aErr) {
      // Roll the key back so it stays available.
      await supabaseAdmin.from("license_keys").update({ status: "available" }).eq("id", key.id);
      throw new Error(aErr.message);
    }

    // 5) Trigger existing fulfillment / email flow (best-effort).
    try {
      await supabaseAdmin.rpc("start_fulfillment_for_order", { _order_id: item.order_id });
    } catch (e) {
      console.error("[assign-license] start_fulfillment_for_order failed", e);
    }
    try {
      const { enqueueEmail } = await import("@/lib/emails/service.server");
      const { data: order } = await supabaseAdmin
        .from("orders")
        .select("order_number, email, currency")
        .eq("id", item.order_id)
        .maybeSingle();
      const { data: assignments } = await supabaseAdmin
        .from("license_assignments")
        .select("license_keys(key_value), order_items(product_name)")
        .eq("order_id", item.order_id);
      if (order?.email && assignments?.length) {
        const block = assignments
          .map((a: any) => `${a.order_items?.product_name ?? "Product"}: ${a.license_keys?.key_value ?? ""}`)
          .join("\n");
        await enqueueEmail({
          templateKey: "license_delivery",
          recipient: order.email,
          vars: { order_number: order.order_number, license_block: block },
        });
      }
    } catch (e) {
      console.error("[assign-license] email dispatch failed", e);
    }

    return { ok: true };
  });
