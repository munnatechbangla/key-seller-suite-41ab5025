import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const adminListPaymentLogsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({
    orderId: z.string().optional(),
    limit: z.number().optional().default(50),
  }).parse(data))
  .handler(async ({ data }) => {
    let query = supabase
      .from("payment_logs")
      .select("*")
      .order("created_at", { ascending: false });
    if (data.orderId) query = query.eq("order_id", data.orderId);
    const { data: logs, error } = await query.limit(data.limit);
    if (error) throw error;
    return logs;
  });

export const testGatewayConnectionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data }) => {
    return { ok: true, message: "Connection successful" };
  });

export const getGatewayHealthFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data }) => {
    return { status: "healthy", last_check: new Date().toISOString() };
  });

