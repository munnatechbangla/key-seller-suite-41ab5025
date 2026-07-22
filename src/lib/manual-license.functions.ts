// Manual License Delivery — admin types license info directly for License Key
// products. Independent of license_pools / license_keys / license_assignments.
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

const PAID_STATUSES = ["paid", "processing", "completed"] as const;

function isLicenseProduct(p: any) {
  if (!p) return false;
  return (
    p.product_type === "license_key" ||
    p.delivery_type === "license_key" ||
    !!p.is_license_key
  );
}

export const adminListManualLicenseDeliveriesFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ orderId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sb = context.supabase as any;

    const { data: order, error: oErr } = await sb
      .from("orders")
      .select("id, order_number, status, email, user_id")
      .eq("id", data.orderId)
      .maybeSingle();
    if (oErr) throw new Error(oErr.message);
    if (!order) throw new Error("Order not found");

    const eligible = (PAID_STATUSES as readonly string[]).includes(order.status);

    const { data: items, error: iErr } = await sb
      .from("order_items")
      .select("id, product_id, product_name, qty, products(product_type, delivery_type, is_license_key)")
      .eq("order_id", data.orderId);
    if (iErr) throw new Error(iErr.message);

    const licenseItems = (items ?? []).filter((it: any) => isLicenseProduct(it.products));
    const ids = licenseItems.map((i: any) => i.id);

    const deliveriesByItem: Record<string, any> = {};
    if (ids.length) {
      const { data: recs, error: dErr } = await sb
        .from("manual_license_deliveries")
        .select("*")
        .in("order_item_id", ids);
      if (dErr) throw new Error(dErr.message);
      for (const r of recs ?? []) deliveriesByItem[r.order_item_id] = r;
    }

    return {
      order: { id: order.id, order_number: order.order_number, status: order.status, eligible },
      items: licenseItems.map((it: any) => ({
        order_item_id: it.id,
        product_id: it.product_id,
        product_name: it.product_name,
        qty: it.qty,
        delivery: deliveriesByItem[it.id] ?? null,
      })),
    };
  });

const saveSchema = z.object({
  orderItemId: z.string().uuid(),
  licenseName: z.string().min(1, "License name is required"),
  licenseKey: z.string().min(1, "License key is required"),
  expiryDate: z.string().nullable().optional(),
  platform: z.string().nullable().optional(),
  instructions: z.string().nullable().optional(),
  deliver: z.boolean().optional().default(true),
});

export const adminSaveManualLicenseDeliveryFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => saveSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sb = context.supabase as any;

    // Validate item + order
    const { data: item, error: iErr } = await sb
      .from("order_items")
      .select("id, order_id, product_id, orders(status, user_id, email, order_number), products(product_type, delivery_type, is_license_key)")
      .eq("id", data.orderItemId)
      .maybeSingle();
    if (iErr) throw new Error(iErr.message);
    if (!item) throw new Error("Order item not found");
    if (!isLicenseProduct(item.products)) throw new Error("Item is not a License Key product");
    if (!(PAID_STATUSES as readonly string[]).includes(item.orders?.status)) {
      throw new Error("Order must be paid, processing, or completed");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Upsert manual delivery record
    const payload = {
      order_id: item.order_id,
      order_item_id: item.id,
      product_id: item.product_id,
      customer_id: item.orders?.user_id ?? null,
      license_name: data.licenseName.trim(),
      license_key: data.licenseKey.trim(),
      expiry_date: data.expiryDate?.trim() ? data.expiryDate : null,
      platform: data.platform?.trim() || null,
      instructions: data.instructions?.trim() || null,
      delivered_by: context.userId,
      delivered_at: new Date().toISOString(),
    };
    const { data: saved, error: uErr } = await supabaseAdmin
      .from("manual_license_deliveries")
      .upsert(payload, { onConflict: "order_item_id" })
      .select("*")
      .single();
    if (uErr) throw new Error(uErr.message);

    // Draft: save only, do not mark fulfillment delivered or send email.
    if (!data.deliver) {
      return { ok: true, delivery: saved, notified: false, draft: true };
    }

    // Mark fulfillment delivered (find or create the fulfillment row for the item)
    const nowIso = new Date().toISOString();
    let fulfillmentId: string | null = null;
    const { data: existingF } = await supabaseAdmin
      .from("order_fulfillments")
      .select("id")
      .eq("order_item_id", item.id)
      .maybeSingle();
    if (existingF) {
      fulfillmentId = existingF.id;
      await supabaseAdmin
        .from("order_fulfillments")
        .update({
          fulfillment_status: "delivered",
          delivery_type: "license_key",
          completed_at: nowIso,
          started_at: nowIso,
          failure_reason: null,
          metadata: { manual_license_delivery_id: saved.id, delivered_at: nowIso, source: "manual_license" },
        })
        .eq("id", existingF.id);
    } else {
      const { data: newF } = await supabaseAdmin
        .from("order_fulfillments")
        .insert({
          order_id: item.order_id,
          order_item_id: item.id,
          product_id: item.product_id,
          fulfillment_status: "delivered",
          delivery_type: "license_key",
          started_at: nowIso,
          completed_at: nowIso,
          failure_reason: null,
          metadata: { manual_license_delivery_id: saved.id, source: "manual_license" },
        })
        .select("id")
        .single();
      fulfillmentId = newF?.id ?? null;
    }

    // Void any stale pool-based license assignment for this item so the
    // customer's "My Licenses" list has exactly one delivered record
    // (the manual_license_deliveries row) instead of a duplicate pool row
    // with a blank / unrelated key.
    await supabaseAdmin
      .from("license_assignments")
      .delete()
      .eq("order_item_id", item.id);

    // Timeline logs
    if (fulfillmentId) {
      const logs = [
        { fulfillment_id: fulfillmentId, event: "manual_delivery_started", message: "Admin started manual license delivery", performed_by: context.userId, metadata: {} },
        { fulfillment_id: fulfillmentId, event: "license_delivered", message: `License "${saved.license_name}" delivered manually`, performed_by: context.userId, metadata: { license_key_masked: maskKey(saved.license_key) } },
      ];
      await supabaseAdmin.from("fulfillment_logs").insert(logs);
    }

    // Email
    let notified = false;
    try {
      const { enqueueEmail } = await import("@/lib/emails/service.server");
      const recipient = item.orders?.email;
      if (recipient) {
        const block = renderLicenseBlock(saved);
        await enqueueEmail({
          templateKey: "license_delivery",
          recipient,
          vars: {
            order_number: item.orders?.order_number ?? "",
            license_block: block,
          },
        });
        notified = true;
        if (fulfillmentId) {
          await supabaseAdmin.from("fulfillment_logs").insert({
            fulfillment_id: fulfillmentId,
            event: "customer_notified",
            message: `License delivery email sent to ${recipient}`,
            performed_by: context.userId,
            metadata: {},
          });
        }
      }
    } catch (e) {
      console.error("[manual-license] email failed", e);
    }

    return { ok: true, delivery: saved, notified, draft: false };
  });

export const getMyManualLicensesFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    // RLS restricts to the current customer. Only surface deliveries whose
    // fulfillment row has been marked delivered (drafts stay hidden).
    const { data, error } = await sb
      .from("manual_license_deliveries")
      .select("id, order_id, order_item_id, license_name, license_key, expiry_date, platform, instructions, delivered_at, order_items(product_name, product_slug), orders(order_number)")
      .order("delivered_at", { ascending: false });
    if (error) throw new Error(error.message);
    const items = (data ?? []) as any[];
    if (!items.length) return [];
    const itemIds = items.map((r) => r.order_item_id);
    const { data: fulfs } = await sb
      .from("order_fulfillments")
      .select("order_item_id, fulfillment_status")
      .in("order_item_id", itemIds);
    const delivered = new Set(
      (fulfs ?? []).filter((f: any) => f.fulfillment_status === "delivered").map((f: any) => f.order_item_id),
    );
    return items.filter((r) => delivered.has(r.order_item_id));
  });


function maskKey(k: string): string {
  if (!k) return "";
  if (k.length <= 6) return "*".repeat(k.length);
  return `${k.slice(0, 3)}${"*".repeat(Math.max(3, k.length - 6))}${k.slice(-3)}`;
}

function renderLicenseBlock(d: any): string {
  const rows: string[] = [];
  rows.push(`<p><strong>License Name:</strong> ${escapeHtml(d.license_name)}</p>`);
  rows.push(`<p><strong>License Key:</strong> <code>${escapeHtml(d.license_key)}</code></p>`);
  if (d.expiry_date) rows.push(`<p><strong>Expiry Date:</strong> ${escapeHtml(String(d.expiry_date))}</p>`);
  if (d.platform) rows.push(`<p><strong>Platform:</strong> ${escapeHtml(d.platform)}</p>`);
  if (d.instructions) rows.push(`<p><strong>Instructions:</strong><br/>${escapeHtml(d.instructions).replace(/\n/g, "<br/>")}</p>`);
  return rows.join("\n");
}

function escapeHtml(s: string) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
