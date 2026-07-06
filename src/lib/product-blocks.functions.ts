import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId, _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

const blockInput = z.object({
  id: z.string().uuid().optional(),
  product_id: z.string().uuid(),
  block_type: z.string().min(1),
  json_content: z.any().optional(),
  enabled: z.boolean().default(true),
  sort_order: z.number().default(0),
});

// Admin
export const productBlocksListFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { product_id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: rows, error } = await (context.supabase as any)
      .from("product_content_blocks").select("*")
      .eq("product_id", data.product_id)
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const productBlockUpsertFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => blockInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: row, error } = await (context.supabase as any)
      .from("product_content_blocks").upsert(data).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const productBlockDeleteFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await (context.supabase as any)
      .from("product_content_blocks").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const productBlockDuplicateFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sb = context.supabase as any;
    const { data: src, error } = await sb.from("product_content_blocks").select("*").eq("id", data.id).single();
    if (error) throw new Error(error.message);
    const { id, created_at, updated_at, ...rest } = src;
    const { data: row, error: insErr } = await sb.from("product_content_blocks")
      .insert({ ...rest, sort_order: (rest.sort_order ?? 0) + 1 })
      .select().single();
    if (insErr) throw new Error(insErr.message);
    return row;
  });

export const productBlockReorderFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { items: Array<{ id: string; sort_order: number }> }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    for (const it of data.items) {
      const { error } = await (context.supabase as any)
        .from("product_content_blocks")
        .update({ sort_order: it.sort_order }).eq("id", it.id);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

// Public — read enabled blocks for a product (used by storefront).
export const productBlocksPublicFn = createServerFn({ method: "GET" })
  .inputValidator((d: { product_id: string }) => d)
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const sb: any = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
    );
    const { data: rows } = await sb.from("product_content_blocks")
      .select("*").eq("product_id", data.product_id).eq("enabled", true)
      .order("sort_order", { ascending: true });
    return rows ?? [];
  });
