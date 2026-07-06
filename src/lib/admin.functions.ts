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
    const { data, error } = await context.supabase
      .from("products")
      .select("id, title, slug, regular_price, sale_price, status, stock_status, is_featured, sales_count, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const productTypeEnum = z.enum([
  "downloadable", "license_key", "subscription", "account", "external", "manual",
]);
const deliveryTypeEnum = z.enum([
  "download", "license_key", "account", "manual", "external_url",
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
});

export const adminUpsertProductFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => productSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.id) {
      const { error } = await context.supabase.from("products").update(data).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    }
    const { data: row, error } = await context.supabase.from("products").insert(data).select("id").single();
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
    let q = context.supabase
      .from("orders")
      .select("id, order_number, email, customer_name, total, currency, status, payment_method, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.status) q = q.eq("status", data.status as any);
    if (data.search) q = q.or(`order_number.ilike.%${data.search}%,email.ilike.%${data.search}%`);
    const { data: rows, error } = await q;
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
