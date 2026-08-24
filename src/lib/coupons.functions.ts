import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

export const getCoupons = createServerFn({ method: "GET" })
  .handler(async () => {
    const { data, error } = await supabase
      .from("coupons")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data;
  });

export const adminUpsertCoupon = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({
    id: z.string().optional(),
    code: z.string(),
    description: z.string().optional().nullable(),
    type: z.enum(["fixed", "percent", "free_shipping", "free_product"]),
    value: z.number(),
    min_order_amount: z.number().optional().nullable(),
    max_discount: z.number().optional().nullable(),
    usage_limit: z.number().optional().nullable(),
    per_user_limit: z.number().optional().nullable(),
    starts_at: z.string().optional().nullable(),
    ends_at: z.string().optional().nullable(),
    first_order_only: z.boolean().optional(),
    new_customer_only: z.boolean().optional(),
    is_active: z.boolean().optional(),
    created_by: z.string(),
  }).parse(data))
  .handler(async ({ data }) => {
    const { data: coupon, error } = await supabase
      .from("coupons")
      .upsert({
        id: data.id || undefined,
        code: data.code,
        description: data.description,
        type: data.type as any,
        value: data.value,
        min_order_amount: data.min_order_amount,
        max_discount: data.max_discount,
        usage_limit: data.usage_limit,
        per_user_limit: data.per_user_limit,
        starts_at: data.starts_at,
        ends_at: data.ends_at,
        first_order_only: data.first_order_only ?? false,
        new_customer_only: data.new_customer_only ?? false,
        is_active: data.is_active ?? true,
        created_by: data.created_by,
      } as any)
      .select()
      .single();

    if (error) throw error;
    return coupon;
  });

export const adminDeleteCoupon = createServerFn({ method: "POST" })
  .inputValidator((data) => z.string().parse(data))
  .handler(async ({ data: id }) => {
    const { error } = await supabase
      .from("coupons")
      .delete()
      .eq("id", id);

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
