import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getMyManualLicensesFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await supabase
      .from("manual_license_deliveries" as any)
      .select("*, order_items(*, orders(order_number, status))")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    
    return (data || []) as any[];
  });

export const adminListManualLicenseDeliveriesFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { data, error } = await supabase
      .from("manual_license_deliveries" as any)
      .select("*, order_items(*, orders(order_number, status))")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  });

export const adminSaveManualLicenseDeliveryFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.any().parse(data))
  .handler(async ({ data }) => {
    const { data: res, error } = await supabase
      .from("manual_license_deliveries" as any)
      .upsert(data)
      .select()
      .single();
    if (error) throw error;
    return res;
  });

