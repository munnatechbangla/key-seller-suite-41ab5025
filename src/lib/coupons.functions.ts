import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const adminListCouponsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { data, error } = await supabase
      .from("coupons")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  });

export const adminUpsertCouponFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.any().parse(data))
  .handler(async ({ data }) => {
    const { data: coupon, error } = await supabase
      .from("coupons")
      .upsert(data)
      .select()
      .single();
    if (error) throw error;
    return coupon;
  });

export const adminDeleteCouponFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data: { id } }) => {
    const { error } = await supabase.from("coupons").delete().eq("id", id);
    if (error) throw error;
    return { success: true };
  });

export const adminToggleCouponFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string(), is_active: z.boolean() }).parse(data))
  .handler(async ({ data }) => {
    const { error } = await supabase.from("coupons").update({ is_active: data.is_active } as any).eq("id", data.id);
    if (error) throw error;
    return { success: true };
  });

export const validateCoupon = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({
    code: z.string(),
    orderTotal: z.number(),
    userId: z.string().optional(),
  }).parse(data))
  .handler(async ({ data }) => {
    const { data: result, error } = await supabase
      .rpc("validate_coupon", {
        _code: data.code,
        _user_id: data.userId || undefined,
        _order_total: data.orderTotal,
      });

    if (error) throw error;
    return result as { valid: boolean; discount?: number; message?: string };
  });

