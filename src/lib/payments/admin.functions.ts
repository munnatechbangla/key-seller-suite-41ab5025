import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

export const adminListPaymentGateways = createServerFn({ method: "GET" })
  .handler(async () => {
    const { data, error } = await supabase
      .from("payment_gateways")
      .select("*")
      .order("sort_order", { ascending: true });

    if (error) throw error;
    return data;
  });

export const adminUpsertPaymentGateway = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({
    id: z.string().optional(),
    name: z.string(),
    slug: z.string(),
    type: z.string(),
    config: z.any().optional(),
    is_active: z.boolean().optional(),
    sort_order: z.number().optional(),
  }).parse(data))
  .handler(async ({ data }) => {
    const { data: gateway, error } = await supabase
      .from("payment_gateways")
      .upsert({
        id: data.id || undefined,
        name: data.name,
        slug: data.slug,
        type: data.type,
        config: data.config || {},
        is_active: data.is_active ?? true,
        sort_order: data.sort_order || 0,
      } as any)
      .select()
      .single();

    if (error) throw error;
    return gateway;
  });

export const adminListPaymentLogs = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({
    orderId: z.string().optional(),
    limit: z.number().optional().default(50),
  }).parse(data))
  .handler(async ({ data }) => {
    let query = supabase
      .from("payment_logs")
      .select("*")
      .order("created_at", { ascending: false });

    if (data.orderId) {
      query = query.eq("order_id", data.orderId);
    }

    const { data: logs, error } = await query.limit(data.limit);
    if (error) throw error;
    return logs;
  });
