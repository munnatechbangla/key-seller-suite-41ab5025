/**
 * P2A — Variant System V2: server functions (foundation).
 *
 * Public reads: list attributes + options + variants for a product.
 * Admin writes: attribute/option CRUD, variant upsert/delete, bulk generate.
 *
 * NOTE: This module is additive. It does not touch checkout/orders/fulfillment/
 * inventory/subscription/license logic — those integrations land in P2D.
 */
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ---------------- Types ----------------
export type AttributeDisplayType = "select" | "color" | "image" | "button";

export type ProductAttribute = {
  id: string;
  product_id: string;
  name: string;
  slug: string | null;
  display_type: AttributeDisplayType;
  sort_order: number;
  options: ProductAttributeOption[];
};

export type ProductAttributeOption = {
  id: string;
  attribute_id: string;
  value: string;
  label: string;
  color: string | null;
  image: string | null;
  sort_order: number;
};

export type ProductVariant = {
  id: string;
  product_id: string;
  name: string;
  sku: string | null;
  price: number;
  sale_price: number | null;
  stock: number | null;
  stock_status: string;
  status: string;
  visibility: string;
  attributes: Record<string, unknown>;
  attribute_option_ids: string[];
  thumbnail_url: string | null;
  delivery_type: string | null;
  inventory_pool_id: string | null;
  subscription_pool_id: string | null;
  license_pool_id: string | null;
  weight: number | null;
  dimensions: Record<string, unknown>;
  sort_order: number;
};

// ---------------- Public reads (SSR-safe) ----------------
function publicClient() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

export const listProductAttributesFn = createServerFn({ method: "GET" })
  .inputValidator((d: { productId: string }) => d)
  .handler(async ({ data }) => {
    const sb = publicClient() as any;
    const { data: attrs, error } = await sb
      .from("product_attributes")
      .select("id, product_id, name, slug, display_type, sort_order")
      .eq("product_id", data.productId)
      .order("sort_order", { ascending: true });
    if (error) throw error;

    const ids = (attrs ?? []).map((a: any) => a.id);
    const { data: opts } = ids.length
      ? await sb
          .from("product_attribute_options")
          .select("id, attribute_id, value, label, color, image, sort_order")
          .in("attribute_id", ids)
          .order("sort_order", { ascending: true })
      : { data: [] as any[] };

    return (attrs ?? []).map((a: any) => ({
      ...a,
      options: (opts ?? []).filter((o: any) => o.attribute_id === a.id),
    })) as ProductAttribute[];
  });

export const listProductVariantsFn = createServerFn({ method: "GET" })
  .inputValidator((d: { productId: string }) => d)
  .handler(async ({ data }) => {
    const sb = publicClient() as any;
    const { data: rows, error } = await sb
      .from("product_variations")
      .select("*")
      .eq("product_id", data.productId)
      .order("sort_order", { ascending: true });
    if (error) throw error;
    return (rows ?? []) as ProductVariant[];
  });

// ---------------- Admin helpers ----------------
async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  if (!data) throw new Error("Forbidden");
}

// ---------------- Attributes ----------------
export const adminUpsertAttributeFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    id?: string;
    product_id: string;
    name: string;
    slug?: string | null;
    display_type?: AttributeDisplayType;
    sort_order?: number;
  }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const sb = (context as any).supabase;
    const slug = data.slug ?? data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const row = {
      id: data.id,
      product_id: data.product_id,
      name: data.name,
      slug,
      display_type: data.display_type ?? "select",
      sort_order: data.sort_order ?? 0,
    };
    const { data: out, error } = await sb
      .from("product_attributes")
      .upsert(row)
      .select("id")
      .single();
    if (error) throw error;
    return { id: out.id as string };
  });

export const adminDeleteAttributeFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const { error } = await (context as any).supabase
      .from("product_attributes")
      .delete()
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// ---------------- Options ----------------
export const adminUpsertOptionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    id?: string;
    attribute_id: string;
    value: string;
    label: string;
    color?: string | null;
    image?: string | null;
    sort_order?: number;
  }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const { data: out, error } = await (context as any).supabase
      .from("product_attribute_options")
      .upsert({
        id: data.id,
        attribute_id: data.attribute_id,
        value: data.value,
        label: data.label,
        color: data.color ?? null,
        image: data.image ?? null,
        sort_order: data.sort_order ?? 0,
      })
      .select("id")
      .single();
    if (error) throw error;
    return { id: out.id as string };
  });

export const adminDeleteOptionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const { error } = await (context as any).supabase
      .from("product_attribute_options")
      .delete()
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// ---------------- Variants ----------------
export type VariantUpsertInput = {
  id?: string;
  product_id: string;
  name?: string;
  sku?: string | null;
  price: number;
  sale_price?: number | null;
  stock?: number | null;
  stock_status?: string;
  status?: string;
  visibility?: string;
  attribute_option_ids?: string[];
  thumbnail_url?: string | null;
  delivery_type?: string | null;
  inventory_pool_id?: string | null;
  subscription_pool_id?: string | null;
  license_pool_id?: string | null;
  weight?: number | null;
  dimensions?: Record<string, unknown>;
  sort_order?: number;
};

async function buildAttributeMap(sb: any, optionIds: string[]) {
  if (!optionIds.length) return {};
  const { data } = await sb
    .from("product_attribute_options")
    .select("id, value, label, attribute_id, product_attributes(slug, name)")
    .in("id", optionIds);
  const out: Record<string, string> = {};
  (data ?? []).forEach((o: any) => {
    const key = o.product_attributes?.slug ?? o.product_attributes?.name ?? o.attribute_id;
    out[key] = o.label ?? o.value;
  });
  return out;
}

export const adminUpsertVariantFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: VariantUpsertInput) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const sb = (context as any).supabase;
    const optionIds = data.attribute_option_ids ?? [];
    const attrMap = await buildAttributeMap(sb, optionIds);
    const name = data.name?.trim() || Object.values(attrMap).join(" / ") || "Variant";

    const row = {
      id: data.id,
      product_id: data.product_id,
      name,
      sku: data.sku ?? null,
      price: data.price,
      sale_price: data.sale_price ?? null,
      stock: data.stock ?? null,
      stock_status: data.stock_status ?? "in_stock",
      status: data.status ?? "active",
      visibility: data.visibility ?? "public",
      attributes: attrMap,
      attribute_option_ids: optionIds,
      thumbnail_url: data.thumbnail_url ?? null,
      delivery_type: data.delivery_type ?? null,
      inventory_pool_id: data.inventory_pool_id ?? null,
      subscription_pool_id: data.subscription_pool_id ?? null,
      license_pool_id: data.license_pool_id ?? null,
      weight: data.weight ?? null,
      dimensions: data.dimensions ?? {},
      sort_order: data.sort_order ?? 0,
    };
    const { data: out, error } = await sb
      .from("product_variations")
      .upsert(row)
      .select("id")
      .single();
    if (error) throw error;
    return { id: out.id as string };
  });

export const adminDeleteVariantFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const { error } = await (context as any).supabase
      .from("product_variations")
      .delete()
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

/**
 * Generate every attribute-option combination as a variant row.
 * Skips combinations that already exist (matched by sorted option-id set).
 */
export const adminGenerateVariantsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { product_id: string; default_price?: number }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const sb = (context as any).supabase;

    const { data: attrs, error: aErr } = await sb
      .from("product_attributes")
      .select("id, name, slug, sort_order, product_attribute_options(id, value, label, sort_order)")
      .eq("product_id", data.product_id)
      .order("sort_order", { ascending: true });
    if (aErr) throw aErr;

    const groups: { attr: any; options: any[] }[] = (attrs ?? [])
      .map((a: any) => ({
        attr: a,
        options: [...(a.product_attribute_options ?? [])].sort(
          (x, y) => x.sort_order - y.sort_order,
        ),
      }))
      .filter((g: any) => g.options.length > 0);

    if (!groups.length) return { created: 0, skipped: 0 };

    // cartesian product
    let combos: any[][] = [[]];
    for (const g of groups) {
      const next: any[][] = [];
      for (const combo of combos) {
        for (const opt of g.options) next.push([...combo, opt]);
      }
      combos = next;
    }

    const { data: existing } = await sb
      .from("product_variations")
      .select("id, attribute_option_ids")
      .eq("product_id", data.product_id);
    const existingKeys = new Set(
      (existing ?? []).map((r: any) =>
        [...(r.attribute_option_ids ?? [])].sort().join("|"),
      ),
    );

    const rows: any[] = [];
    combos.forEach((combo, idx) => {
      const optionIds = combo.map((o: any) => o.id);
      const key = [...optionIds].sort().join("|");
      if (existingKeys.has(key)) return;
      const attrMap: Record<string, string> = {};
      combo.forEach((o: any, i: number) => {
        const g = groups[i].attr;
        attrMap[g.slug ?? g.name] = o.label ?? o.value;
      });
      rows.push({
        product_id: data.product_id,
        name: Object.values(attrMap).join(" / "),
        price: data.default_price ?? 0,
        stock_status: "in_stock",
        status: "active",
        visibility: "public",
        attributes: attrMap,
        attribute_option_ids: optionIds,
        dimensions: {},
        sort_order: idx,
      });
    });

    if (rows.length) {
      const { error } = await sb.from("product_variations").insert(rows);
      if (error) throw error;
    }
    return { created: rows.length, skipped: combos.length - rows.length };
  });
