import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

export const getManualLicenseDeliveries = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({
    orderId: z.string().optional(),
    orderItemId: z.string().optional(),
  }).parse(data))
  .handler(async ({ data }) => {
    // 1. Get the order and its items
    const { data: order, error: oErr } = await supabase
      .from("orders")
      .select("id, status")
      .eq("id", data.orderId || "")
      .single();
    
    if (oErr || !order) throw new Error("Order not found");

    const { data: orderItems, error: itemsErr } = await supabase
      .from("order_items")
      .select("id, product_name, qty, product_id")
      .eq("order_id", order.id);

    if (itemsErr) throw itemsErr;

    // 2. Get manual deliveries for these items
    const { data: deliveries, error: dErr } = await supabase
      .from("manual_license_deliveries")
      .select("*")
      .eq("order_id", order.id);
    
    if (dErr) throw dErr;

    // 3. Map into the shape expected by ManualLicenseDeliveryPanel
    const items = (orderItems || []).map(item => {
      const delivery = (deliveries || []).find(d => d.order_item_id === item.id);
      return {
        order_item_id: item.id,
        product_id: item.product_id,
        product_name: item.product_name,
        qty: item.qty,
        delivery: delivery ? {
          id: delivery.id,
          license_name: delivery.license_name,
          license_key: delivery.license_key,
          expiry_date: delivery.expiry_date,
          platform: delivery.platform,
          instructions: delivery.instructions,
          delivered_at: delivery.delivered_at
        } : null
      };
    });

    return {
      order: {
        id: order.id,
        eligible: order.status === 'paid'
      },
      items
    };
  });

export const adminListManualLicenseDeliveriesFn = getManualLicenseDeliveries;

export const adminSaveManualLicenseDeliveryFn = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({
    id: z.string().optional(),
    orderItemId: z.string(),
    licenseName: z.string(),
    licenseKey: z.string(),
    expiryDate: z.string().optional().nullable(),
    platform: z.string().optional().nullable(),
    instructions: z.string().optional().nullable(),
    deliver: z.boolean().optional(),
  }).parse(data))
  .handler(async ({ data }) => {
    // Lookup order_id and product_id from order_item
    const { data: item, error: itemErr } = await supabase
      .from("order_items")
      .select("order_id, product_id")
      .eq("id", data.orderItemId)
      .single();
    
    if (itemErr || !item) throw new Error("Order item not found");

    const { data: delivery, error } = await supabase
      .from("manual_license_deliveries")
      .upsert({
        id: data.id || undefined,
        order_id: item.order_id,
        order_item_id: data.orderItemId,
        product_id: item.product_id,
        license_name: data.licenseName,
        license_key: data.licenseKey,
        expiry_date: data.expiryDate,
        platform: data.platform,
        instructions: data.instructions,
        delivered_at: new Date().toISOString(),
        delivered_by: 'admin' // In a real app, this would be context.userId
      } as any)
      .select()
      .single();

    if (error) throw error;
    return { 
      ...delivery,
      notified: data.deliver 
    };
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
