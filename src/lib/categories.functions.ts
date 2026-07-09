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

export type AdminCategory = {
  id: string;
  parent_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
  seo_title: string | null;
  seo_description: string | null;
  product_count?: number;
};

export const adminListCategoriesFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const [catsRes, countsRes] = await Promise.all([
      context.supabase
        .from("product_categories")
        .select("id, parent_id, name, slug, description, icon, image_url, sort_order, is_active, seo_title, seo_description")
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),
      context.supabase.from("products").select("category_id"),
    ]);
    if (catsRes.error) throw new Error(catsRes.error.message);
    const tally = new Map<string, number>();
    (countsRes.data ?? []).forEach((r: any) => {
      if (r.category_id) tally.set(r.category_id, (tally.get(r.category_id) ?? 0) + 1);
    });
    return (catsRes.data ?? []).map((c: any) => ({ ...c, product_count: tally.get(c.id) ?? 0 })) as AdminCategory[];
  });

const categorySchema = z.object({
  id: z.string().uuid().optional(),
  parent_id: z.string().uuid().nullable().optional(),
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  image_url: z.string().nullable().optional(),
  sort_order: z.number().int().default(0),
  is_active: z.boolean().default(true),
  seo_title: z.string().nullable().optional(),
  seo_description: z.string().nullable().optional(),
});

export const adminUpsertCategoryFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => categorySchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const payload: any = { ...data };
    if (payload.id) {
      const { error } = await context.supabase.from("product_categories").update(payload).eq("id", payload.id);
      if (error) throw new Error(error.message);
      return { ok: true, id: payload.id as string };
    }
    const { data: row, error } = await context.supabase
      .from("product_categories")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: row.id as string };
  });

export const adminDeleteCategoryFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    // Detach products in this category to preserve them
    await context.supabase.from("products").update({ category_id: null }).eq("category_id", data.id);
    // Reparent any children up one level
    await context.supabase.from("product_categories").update({ parent_id: null }).eq("parent_id", data.id);
    const { error } = await context.supabase.from("product_categories").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDuplicateCategoryFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: src, error } = await context.supabase
      .from("product_categories")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    const { id, created_at, updated_at, ...rest } = src as any;
    const copy = {
      ...rest,
      name: `${rest.name} (Copy)`,
      slug: `${rest.slug}-copy-${Math.random().toString(36).slice(2, 6)}`,
    };
    const { data: row, error: e2 } = await context.supabase
      .from("product_categories")
      .insert(copy)
      .select("id")
      .single();
    if (e2) throw new Error(e2.message);
    return { ok: true, id: row.id as string };
  });
