import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type DeliveryDownload = {
  id: string;
  file_name: string;
  file_url: string;
  version: string | null;
  file_size: number | null;
};

export type DeliveryCustomField = {
  field_name: string;
  field_label: string;
  field_type: string;
  value: string | null;
};

export type DeliveryItem = {
  order_item_id: string;
  order_id: string;
  order_number: string;
  order_created_at: string;
  qty: number;
  product: {
    id: string;
    slug: string;
    name: string;
    product_type: string; // downloadable | license_key | subscription | account | external | manual
    delivery_type: string; // download | license_key | account | manual | external_url
    external_url: string | null;
    thumbnail_url?: string | null;
  };
  downloads: DeliveryDownload[];
  license_keys: string[];
  custom_fields: DeliveryCustomField[];
};

async function runDelivery(sb: any, params: { orderId?: string; orderNumber?: string; onlyPaid: boolean }) {
  // Resolve order(s)
  let orderQuery = sb
    .from("orders")
    .select("id, order_number, status, created_at, email, user_id")
    .order("created_at", { ascending: false });
  if (params.orderId) orderQuery = orderQuery.eq("id", params.orderId);
  if (params.orderNumber) orderQuery = orderQuery.eq("order_number", params.orderNumber);
  if (params.onlyPaid) orderQuery = orderQuery.in("status", ["paid", "completed"]);
  const { data: orders, error: oe } = await orderQuery;
  if (oe) throw new Error(oe.message);
  const orderRows = (orders ?? []) as any[];
  if (orderRows.length === 0) return [] as DeliveryItem[];

  const orderIds = orderRows.map((o) => o.id);
  const { data: items } = await sb
    .from("order_items")
    .select("id, order_id, product_id, product_slug, product_name, qty")
    .in("order_id", orderIds);
  const itemRows = (items ?? []) as any[];
  if (itemRows.length === 0) return [];

  const productIds = Array.from(new Set(itemRows.map((i) => i.product_id).filter(Boolean)));
  const { data: products } = productIds.length
    ? await sb
        .from("products")
        .select("id, slug, title, product_type, delivery_type, external_url, thumbnail_url")
        .in("id", productIds)
    : { data: [] };
  const productMap = new Map((products ?? []).map((p: any) => [p.id, p]));

  const { data: downloads } = productIds.length
    ? await sb
        .from("product_downloads")
        .select("id, product_id, file_name, file_url, version, file_size, sort_order")
        .in("product_id", productIds)
        .order("sort_order", { ascending: true })
    : { data: [] };
  const downloadsByProduct = new Map<string, DeliveryDownload[]>();
  for (const d of (downloads ?? []) as any[]) {
    const arr = downloadsByProduct.get(d.product_id) ?? [];
    arr.push({ id: d.id, file_name: d.file_name, file_url: d.file_url, version: d.version, file_size: d.file_size });
    downloadsByProduct.set(d.product_id, arr);
  }

  const itemIds = itemRows.map((i) => i.id);
  const { data: assignments } = itemIds.length
    ? await sb
        .from("license_assignments")
        .select("order_item_id, license_keys(key_value)")
        .in("order_item_id", itemIds)
    : { data: [] };
  const keysByItem = new Map<string, string[]>();
  for (const a of (assignments ?? []) as any[]) {
    const k = a.license_keys?.key_value;
    if (!k) continue;
    const arr = keysByItem.get(a.order_item_id) ?? [];
    arr.push(k);
    keysByItem.set(a.order_item_id, arr);
  }

  const { data: cfvs } = await sb
    .from("order_custom_field_values")
    .select("order_id, product_id, field_name, field_label, field_type, value")
    .in("order_id", orderIds);
  const fieldsByKey = new Map<string, DeliveryCustomField[]>();
  for (const v of (cfvs ?? []) as any[]) {
    const key = `${v.order_id}::${v.product_id}`;
    const arr = fieldsByKey.get(key) ?? [];
    arr.push({ field_name: v.field_name, field_label: v.field_label, field_type: v.field_type, value: v.value });
    fieldsByKey.set(key, arr);
  }

  const orderMap = new Map(orderRows.map((o) => [o.id, o]));

  return itemRows.map((it) => {
    const p = productMap.get(it.product_id) as any;
    const ord = orderMap.get(it.order_id) as any;
    return {
      order_item_id: it.id,
      order_id: it.order_id,
      order_number: ord?.order_number ?? "",
      order_created_at: ord?.created_at ?? "",
      qty: it.qty,
      product: {
        id: it.product_id,
        slug: it.product_slug ?? p?.slug ?? "",
        name: it.product_name ?? p?.title ?? "Product",
        product_type: p?.product_type ?? "downloadable",
        delivery_type: p?.delivery_type ?? "download",
        external_url: p?.external_url ?? null,
        thumbnail_url: p?.thumbnail_url ?? null,
      },
      downloads: downloadsByProduct.get(it.product_id) ?? [],
      license_keys: keysByItem.get(it.id) ?? [],
      custom_fields: fieldsByKey.get(`${it.order_id}::${it.product_id}`) ?? [],
    } as DeliveryItem;
  });
}

const orderRefSchema = z.object({
  orderNumber: z.string().optional(),
  orderId: z.string().uuid().optional(),
  email: z.string().email().optional(),
});

/** Guest — RLS filters to public-visible policy; use for thank-you page without login. */
export const getOrderDeliveryGuestFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => orderRefSchema.parse(d))
  .handler(async ({ data }) => {
    if (!data.orderNumber && !data.orderId) return [];
    const { createServerSupabaseClient } = await import("@/integrations/supabase/server-client");
    const sb = createServerSupabaseClient() as any;
    // Verify email ownership when order has one
    if (data.orderNumber) {
      const { data: ord } = await sb.from("orders").select("id, email, user_id").eq("order_number", data.orderNumber).maybeSingle();
      if (!ord) return [];
      if (ord.user_id) return []; // logged-in-owned order — require auth fn
      if (ord.email && data.email && ord.email.toLowerCase() !== data.email.toLowerCase()) return [];
      return runDelivery(sb, { orderId: ord.id, onlyPaid: true });
    }
    return runDelivery(sb, { orderId: data.orderId, onlyPaid: true });
  });

/** Authenticated single-order delivery (thank-you / order-detail). */
export const getOrderDeliveryAuthFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => orderRefSchema.parse(d))
  .handler(async ({ data, context }) => {
    if (!data.orderNumber && !data.orderId) return [];
    return runDelivery(context.supabase as any, {
      orderId: data.orderId,
      orderNumber: data.orderNumber,
      onlyPaid: true,
    });
  });

/** Authenticated — all paid deliveries for signed-in user (download center). */
export const getMyDeliveriesFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => runDelivery(context.supabase as any, { onlyPaid: true }));
