// Order Fulfillment Engine — server functions.
// Wraps the existing payment/inventory/download flow with a centralized
// fulfillment lifecycle. Never modifies the underlying delivery logic.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createServerSupabaseClient } from "@/integrations/supabase/server-client";

export type FulfillmentStatus =
  | "pending"
  | "processing"
  | "waiting_inventory"
  | "manual_review"
  | "delivered"
  | "failed"
  | "cancelled";

export type FulfillmentRow = {
  id: string;
  order_id: string;
  order_item_id: string | null;
  product_id: string | null;
  variation_id: string | null;
  fulfillment_status: FulfillmentStatus;
  delivery_type: string | null;
  inventory_assignment_id: string | null;
  attempt_count: number;
  started_at: string | null;
  completed_at: string | null;
  last_retry_at: string | null;
  failure_reason: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
  product_title?: string | null;
  product_slug?: string | null;
  product_type?: string | null;
  product_delivery_type?: string | null;
  is_license_key?: boolean | null;
};

export type FulfillmentLog = {
  id: string;
  fulfillment_id: string;
  event: string;
  message: string | null;
  performed_by: string | null;
  metadata: Record<string, any>;
  created_at: string;
};

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await (ctx.supabase as any).rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  if (error || !data) throw new Error("Forbidden");
}

// ---------- Readers ----------

const readSchema = z.object({
  orderId: z.string().uuid(),
  email: z.string().optional(),
});

/** Signed-in customer (or admin) — reads via their bearer token. */
export const getOrderFulfillmentsAuthFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => readSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await (context.supabase as any).rpc("get_order_fulfillments", {
      _order_id: data.orderId,
      _email: data.email,
    });
    if (error) throw new Error(error.message);
    return (rows as FulfillmentRow[]) ?? [];
  });

/** Guest — verified by matching email. */
export const getOrderFulfillmentsGuestFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => readSchema.parse(d))
  .handler(async ({ data }) => {
    const sb = createServerSupabaseClient();
    const { data: rows, error } = await sb.rpc("get_order_fulfillments", {
      _order_id: data.orderId,
      _email: data.email,
    });
    if (error) throw new Error(error.message);
    return (rows as FulfillmentRow[]) ?? [];
  });

const timelineSchema = z.object({
  fulfillmentId: z.string().uuid(),
  email: z.string().optional(),
});

export const getFulfillmentTimelineAuthFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => timelineSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await (context.supabase as any).rpc("get_fulfillment_timeline", {
      _fulfillment_id: data.fulfillmentId,
      _email: data.email,
    });
    if (error) throw new Error(error.message);
    return (rows as FulfillmentLog[]) ?? [];
  });

export const getFulfillmentTimelineGuestFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => timelineSchema.parse(d))
  .handler(async ({ data }) => {
    const sb = createServerSupabaseClient();
    const { data: rows, error } = await sb.rpc("get_fulfillment_timeline", {
      _fulfillment_id: data.fulfillmentId,
      _email: data.email,
    });
    if (error) throw new Error(error.message);
    return (rows as FulfillmentLog[]) ?? [];
  });

// ---------- Admin actions ----------

const idSchema = z.object({ fulfillmentId: z.string().uuid() });

export const adminRetryFulfillmentFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: res, error } = await (context.supabase as any).rpc("admin_retry_fulfillment", {
      _fulfillment_id: data.fulfillmentId,
    });
    if (error) throw new Error(error.message);
    return res as { ok: boolean; status: FulfillmentStatus };
  });

export const adminRestartFulfillmentFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: res, error } = await (context.supabase as any).rpc("admin_restart_fulfillment", {
      _fulfillment_id: data.fulfillmentId,
    });
    if (error) throw new Error(error.message);
    return res as { ok: boolean; status: FulfillmentStatus };
  });

const cancelSchema = z.object({
  fulfillmentId: z.string().uuid(),
  reason: z.string().max(500).optional(),
});

export const adminCancelFulfillmentFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => cancelSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: res, error } = await (context.supabase as any).rpc("admin_cancel_fulfillment", {
      _fulfillment_id: data.fulfillmentId,
      _reason: data.reason,
    });
    if (error) throw new Error(error.message);
    return res as { ok: boolean };
  });

/** Kick off fulfillment for a paid order that predates the engine, or after
 *  admin intervention. Idempotent — will not duplicate existing rows. */
export const adminStartFulfillmentForOrderFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ orderId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    // Loaded lazily — the admin client is server-only.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: res, error } = await (supabaseAdmin as any).rpc("start_fulfillment_for_order", {
      _order_id: data.orderId,
    });
    if (error) throw new Error(error.message);
    return { ok: true, created: (res as number) ?? 0 };
  });

/** Subscription-only: admin marks the fulfillment delivered. Never touches
 *  license or download flows — guarded server-side by product_type. */
export const adminMarkSubscriptionDeliveredFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ fulfillmentId: z.string().uuid(), note: z.string().max(1000).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: res, error } = await (context.supabase as any).rpc("admin_mark_subscription_delivered", {
      _fulfillment_id: data.fulfillmentId,
      _note: data.note ?? undefined,
    });
    if (error) throw new Error(error.message);
    return res as { ok: boolean; order_completed: boolean };
  });
