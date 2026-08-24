import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

export const getManualLicenseDeliveries = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({
    orderId: z.string().optional(),
    orderItemId: z.string().optional(),
  }).parse(data))
  .handler(async ({ data }) => {
    let query = supabase
      .from("manual_license_deliveries")
      .select("*")
      .order("delivered_at", { ascending: false });

    if (data.orderId) {
      query = query.eq("order_id", data.orderId);
    }
    if (data.orderItemId) {
      query = query.eq("order_item_id", data.orderItemId);
    }

    const { data: deliveries, error } = await query;
    if (error) throw error;
    return deliveries;
  });

export const adminUpsertManualLicense = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({
    id: z.string().optional(),
    order_id: z.string(),
    order_item_id: z.string(),
    product_id: z.string(),
    customer_id: z.string().optional().nullable(),
    license_name: z.string(),
    license_key: z.string(),
    expiry_date: z.string().optional().nullable(),
    platform: z.string().optional().nullable(),
    instructions: z.string().optional().nullable(),
    delivered_by: z.string(),
  }).parse(data))
  .handler(async ({ data }) => {
    // 1. Upsert delivery
    const { data: delivery, error: deliveryError } = await supabase
      .from("manual_license_deliveries")
      .upsert({
        id: data.id || undefined,
        order_id: data.order_id,
        order_item_id: data.order_item_id,
        product_id: data.product_id,
        customer_id: data.customer_id,
        license_name: data.license_name,
        license_key: data.license_key,
        expiry_date: data.expiry_date,
        platform: data.platform,
        instructions: data.instructions,
        delivered_by: data.delivered_by,
        delivered_at: new Date().toISOString(),
      } as any)
      .select()
      .single();

    if (deliveryError) throw deliveryError;

    // 2. Mark item as fulfilled in order_items if needed
    // Assuming we have a way to track fulfillment status
    
    return delivery;
  });

export const adminDeleteManualLicense = createServerFn({ method: "POST" })
  .inputValidator((data) => z.string().parse(data))
  .handler(async ({ data: id }) => {
    const { error } = await supabase
      .from("manual_license_deliveries")
      .delete()
      .eq("id", id);

    if (error) throw error;
    return { success: true };
  });
