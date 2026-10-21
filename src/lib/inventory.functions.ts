import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

const inventoryTypeEnum = z.enum([
  "license_key",
  "account",
  "download_token",
  "api_key",
  "gift_code",
  "other",
]);
const itemStatusEnum = z.enum(["available", "reserved", "assigned", "expired", "disabled"]);

// ---------- Pools ----------
export const listProductVariationsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ product_id: z.string().uuid().optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    let query = (context.supabase as any)
      .from("product_variations")
      .select("id, product_id, name, sku, attributes")
      .order("sort_order", { ascending: true });
    if (data.product_id) query = query.eq("product_id", data.product_id);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const listInventoryPoolsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase.rpc("admin_list_inventory_pools");
    if (error) throw new Error(error.message);
    return (data as any[]) ?? [];
  });

const poolSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  inventory_type: inventoryTypeEnum.default("license_key"),
  product_id: z.string().uuid().nullable().optional(),
  variation_id: z.string().uuid().nullable().optional(),
  low_stock_threshold: z.number().int().nonnegative().optional(),
  is_active: z.boolean().optional(),
});

export const upsertInventoryPoolFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => poolSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sb = context.supabase as any;
    const payload: any = { ...data };
    if (data.variation_id) {
      if (!data.product_id) throw new Error("Select a product before selecting a variant");
      const { data: variation, error: variationError } = await sb
        .from("product_variations")
        .select("id")
        .eq("id", data.variation_id)
        .eq("product_id", data.product_id)
        .maybeSingle();
      if (variationError) throw new Error(variationError.message);
      if (!variation) throw new Error("Selected variant does not belong to the selected product");
      if (data.inventory_type !== "account") throw new Error("Variant-specific inventory pools are currently supported only for Account inventory");
    }
    if (data.id) {
      const { data: existing, error: existingError } = await sb
        .from("inventory_pools")
        .select("variation_id")
        .eq("id", data.id)
        .maybeSingle();
      if (existingError) throw new Error(existingError.message);
      if (existing?.variation_id !== (data.variation_id ?? null)) {
        const { count, error: itemCountError } = await sb
          .from("inventory_items")
          .select("id", { count: "exact", head: true })
          .eq("pool_id", data.id);
        if (itemCountError) throw new Error(itemCountError.message);
        if ((count ?? 0) > 0) throw new Error("Cannot change a pool's variant after inventory items have been added. Create a separate pool for the new variant.");
      }
      const { error } = await sb.from("inventory_pools").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    }
    payload.created_by = context.userId;
    const { data: row, error } = await sb
      .from("inventory_pools")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: row.id };
  });

export const deleteInventoryPoolFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sb = context.supabase as any;
    const { count, error: cntErr } = await sb
      .from("inventory_items")
      .select("id", { count: "exact", head: true })
      .eq("pool_id", data.id);
    if (cntErr) throw new Error(cntErr.message);
    if ((count ?? 0) > 0) throw new Error("Pool is not empty");
    const { error } = await sb.from("inventory_pools").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Items ----------
const listItemsSchema = z.object({
  pool_id: z.string().uuid(),
  search: z.string().optional(),
  status: itemStatusEnum.optional(),
  page: z.number().int().min(1).default(1),
  page_size: z.number().int().min(1).max(200).default(50),
});

export const listInventoryItemsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => listItemsSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sb = context.supabase as any;
    let q = sb
      .from("inventory_items")
      .select("id, pool_id, inventory_type, value, username, password, notes, status, expires_at, assigned_order_id, assigned_user_id, assigned_at, created_at", { count: "exact" })
      .eq("pool_id", data.pool_id)
      .order("created_at", { ascending: false })
      .range((data.page - 1) * data.page_size, data.page * data.page_size - 1);
    if (data.status) q = q.eq("status", data.status);
    if (data.search) q = q.or(`value.ilike.%${data.search}%,username.ilike.%${data.search}%,notes.ilike.%${data.search}%`);
    const { data: rows, error, count } = await q;
    if (error) throw new Error(error.message);
    return { items: rows ?? [], total: count ?? 0 };
  });

const bulkImportSchema = z.object({
  pool_id: z.string().uuid(),
  items: z
    .array(
      z.object({
        value: z.string().min(1),
        username: z.string().optional().nullable(),
        password: z.string().optional().nullable(),
        notes: z.string().optional().nullable(),
      }),
    )
    .min(1),
});

export const bulkImportInventoryFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => bulkImportSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: res, error } = await (context.supabase as any).rpc("admin_bulk_import_inventory", {
      _pool_id: data.pool_id,
      _items: data.items,
    });
    if (error) throw new Error(error.message);
    return res;
  });

export const addInventoryItemFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      pool_id: z.string().uuid(),
      value: z.string(),
      username: z.string().optional().nullable(),
      password: z.string().optional().nullable(),
      notes: z.string().optional().nullable(),
      credential_fields: z.array(z.object({ label: z.string().min(1), value: z.string() })).optional(),
      expires_at: z.string().optional().nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sb = context.supabase as any;
    const { data: pool, error: pErr } = await sb
      .from("inventory_pools")
      .select("inventory_type")
      .eq("id", data.pool_id)
      .single();
    if (pErr) throw new Error(pErr.message);
    const { error } = await sb.from("inventory_items").insert({
      pool_id: data.pool_id,
      inventory_type: pool.inventory_type,
      value: data.value,
      username: data.username ?? null,
      password: data.password ?? null,
      notes: data.notes ?? null,
      credential_fields: data.credential_fields ?? [],
      expires_at: data.expires_at ?? null,
      created_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setInventoryItemStatusFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), status: itemStatusEnum }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await (context.supabase as any)
      .from("inventory_items")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await (context.supabase as any).from("inventory_logs").insert({
      item_id: data.id,
      action: `status:${data.status}`,
      actor_id: context.userId,
    });
    return { ok: true };
  });

export const deleteInventoryItemFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await (context.supabase as any)
      .from("inventory_items")
      .delete()
      .eq("id", data.id)
      .neq("status", "assigned");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Assignments ----------
export const listInventoryAssignmentsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ pool_id: z.string().uuid().optional(), order_id: z.string().uuid().optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sb = context.supabase as any;
    let q = sb
      .from("inventory_assignments")
      .select("id, order_id, product_id, pool_id, item_id, user_id, email, status, assigned_at, released_at, orders(order_number), inventory_items(value, username)")
      .order("assigned_at", { ascending: false })
      .limit(200);
    if (data.pool_id) q = q.eq("pool_id", data.pool_id);
    if (data.order_id) q = q.eq("order_id", data.order_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const releaseAssignmentFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ assignment_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: res, error } = await (context.supabase as any).rpc("admin_release_inventory_assignment", {
      _assignment_id: data.assignment_id,
    });
    if (error) throw new Error(error.message);
    return res;
  });

export const replaceAssignmentFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ assignment_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: res, error } = await (context.supabase as any).rpc("admin_replace_inventory_assignment", {
      _assignment_id: data.assignment_id,
    });
    if (error) throw new Error(error.message);
    return res;
  });

// ---------- Export ----------
export const exportInventoryFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ pool_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: rows, error } = await (context.supabase as any)
      .from("inventory_items")
      .select("value, username, password, notes, status, created_at")
      .eq("pool_id", data.pool_id)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// ---------- Dashboard ----------
export const getInventoryDashboardSummaryFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await (context.supabase as any).rpc("admin_inventory_summary");
    if (error) throw new Error(error.message);
    return (data ?? {}) as Record<string, number>;
  });

export const getInventoryPoolStatsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await (context.supabase as any).rpc("admin_inventory_pool_stats");
    if (error) throw new Error(error.message);
    return (data as any[]) ?? [];
  });

export const getInventoryRecentActivityFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ limit: z.number().int().min(1).max(200).default(30) }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: rows, error } = await (context.supabase as any).rpc("admin_inventory_recent_activity", {
      _limit: data.limit,
    });
    if (error) throw new Error(error.message);
    return (rows as any[]) ?? [];
  });
