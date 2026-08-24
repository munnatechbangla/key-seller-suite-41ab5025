import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type GatewayType = "builtin" | "custom_auto" | "manual";
export type GatewayRow = {
  id: string;
  name: string;
  slug: string;
  type: GatewayType;
  config: any;
  is_enabled: boolean;
  is_active: boolean;
  mode: "sandbox" | "live";
  logo_url: string | null;
  description: string | null;
  sort_order: number;
};
export type JsonValue = string | number | boolean | null | { [key: string]: JsonValue } | JsonValue[];

export const listEnabledGatewaysFn = createServerFn({ method: "GET" })
  .handler(async () => {
    const { data, error } = await supabase
      .from("payment_gateways")
      .select("*")
      .eq("is_active", true)
      .order("sort_order");
    return (data || []) as GatewayRow[];
  });

export const listAllGatewaysFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { data, error } = await supabase.from("payment_gateways").select("*").order("sort_order");
    return { gateways: (data || []) as GatewayRow[] };
  });

export const upsertGatewayFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.any().parse(data))
  .handler(async ({ data }) => {
    const { data: res, error } = await supabase.from("payment_gateways").upsert(data).select().single();
    if (error) throw error;
    return res;
  });

export const deleteGatewayFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data: { id } }) => {
    const { error } = await supabase.from("payment_gateways").delete().eq("id", id);
    if (error) throw error;
    return { success: true };
  });

export const toggleGatewayFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string(), is_enabled: z.boolean() }).parse(data))
  .handler(async ({ data }) => {
    const { error } = await supabase.from("payment_gateways").update({ is_enabled: data.is_enabled }).eq("id", data.id);
    if (error) throw error;
    return { success: true };
  });

export const reorderGatewaysFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ items: z.array(z.object({ id: z.string(), sort_order: z.number() })) }).parse(data))
  .handler(async ({ data }) => {
    for (const item of data.items) {
      await supabase.from("payment_gateways").update({ sort_order: item.sort_order }).eq("id", item.id);
    }
    return { success: true };
  });

export const listSubmissionsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { data, error } = await supabase.from("payment_submissions" as any).select("*, orders(order_number)").order("created_at", { ascending: false });
    return data || [];
  });

export const getMySubmissionsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await supabase
      .from("payment_submissions" as any)
      .select("*, orders(order_number)")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    return (data || []) as any[];
  });

export const submitManualPaymentFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.any().parse(data))
  .handler(async ({ data, context }) => {
    const { data: res, error } = await supabase
      .from("payment_submissions" as any)
      .insert({ ...data, user_id: context.userId })
      .select()
      .single();
    if (error) throw error;
    return res;
  });

export const reviewSubmissionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string(), status: z.string(), notes: z.string().optional() }).parse(data))
  .handler(async ({ data }) => {
    const { error } = await supabase.from("payment_submissions" as any).update({ status: data.status, admin_notes: data.notes, reviewed_at: new Date().toISOString() }).eq("id", data.id);
    if (error) throw error;
    return { success: true };
  });

