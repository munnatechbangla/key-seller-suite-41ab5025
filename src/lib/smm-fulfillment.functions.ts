import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

const smmStatusEnum = z.enum(["pending", "processing", "partial", "completed", "cancelled", "refunded"]);

export const updateSmmFulfillmentFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      orderItemId: z.string().uuid(),
      status: smmStatusEnum,
      deliveredQuantity: z.number().int().nonnegative(),
      adminNotes: z.string().optional(),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    
    const { data: result, error } = await (context.supabase as any).rpc("update_smm_fulfillment", {
      _order_item_id: data.orderItemId,
      _status: data.status,
      _delivered_quantity: data.deliveredQuantity,
      _admin_notes: data.adminNotes ?? null,
    });

    if (error) throw new Error(error.message);
    return result;
  });
