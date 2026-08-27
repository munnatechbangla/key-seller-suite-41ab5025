import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { csrfGuard } from "@/lib/security/csrf.server";

const validateSchema = z.object({
  code: z.string().min(1).max(64),
  subtotal: z.number().nonnegative(),
  email: z.string().email().optional(),
  productSlugs: z.array(z.string()).default([]),
});

export type ValidateCouponResult =
  | { ok: true; code: string; type: string; value: number; discount: number; description: string | null }
  | { ok: false; reason: string; min?: number };

export const validateCouponFn = createServerFn({ method: "POST" })
  .middleware([csrfGuard])
  .inputValidator((d: unknown) => validateSchema.parse(d))
  .handler(async ({ data }): Promise<ValidateCouponResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let productIds: string[] = [];
    if (data.productSlugs.length) {
      const { data: ps } = await supabaseAdmin.from("products").select("id").in("slug", data.productSlugs);
      productIds = (ps ?? []).map((p: { id: string }) => p.id);
    }
    const { data: result, error } = await supabaseAdmin.rpc("validate_coupon", {
      _code: data.code,
      _subtotal: data.subtotal,
      _email: data.email ?? undefined,
      _product_ids: productIds,
    });
    if (error) return { ok: false, reason: error.message };
    return result as ValidateCouponResult;
  });

// ---------- Admin ----------
async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (!data) throw new Error("Forbidden");
}

export const adminListCouponsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
      .from("coupons")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const couponSchema = z.object({
  id: z.string().uuid().optional(),
  code: z.string().min(2).max(64),
  description: z.string().optional().nullable(),
  type: z.enum(["percent", "fixed", "free_product", "free_download"]).default("percent"),
  value: z.number().nonnegative().default(0),
  min_order_amount: z.number().nonnegative().nullable().optional(),
  max_discount: z.number().nonnegative().nullable().optional(),
  usage_limit: z.number().int().positive().nullable().optional(),
  per_user_limit: z.number().int().positive().nullable().optional(),
  first_order_only: z.boolean().default(false),
  new_customer_only: z.boolean().default(false),
  starts_at: z.string().nullable().optional(),
  ends_at: z.string().nullable().optional(),
  is_active: z.boolean().default(true),
});

export const adminUpsertCouponFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => couponSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const payload = { ...data, code: data.code.trim().toUpperCase(), created_by: context.userId };
    const { data: row, error } = data.id
      ? await (context.supabase as any).from("coupons").update(payload).eq("id", data.id).select().single()
      : await (context.supabase as any).from("coupons").insert(payload).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const adminDeleteCouponFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("coupons").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminToggleCouponFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), is_active: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await (context.supabase as any).from("coupons").update({ is_active: data.is_active }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminCouponStatsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
      .from("coupons")
      .select("id, code, used_count, revenue_generated, usage_limit")
      .order("used_count", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return data ?? [];
  });
