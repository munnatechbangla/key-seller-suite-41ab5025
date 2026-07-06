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

const layoutInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  is_default: z.boolean().default(false),
  enabled: z.boolean().default(true),
  status: z.enum(["draft", "published"]).default("draft"),
});

const sectionInput = z.object({
  id: z.string().uuid().optional(),
  layout_id: z.string().uuid(),
  section_key: z.string().min(1),
  section_type: z.string().min(1),
  title: z.string().nullable().optional(),
  subtitle: z.string().nullable().optional(),
  json_content: z.any().optional(),
  sort_order: z.number().default(0),
  enabled: z.boolean().default(true),
});

// ============ LAYOUTS ============
export const productLayoutsListFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await (context.supabase as any)
      .from("product_layouts")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const productLayoutGetFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: row, error } = await (context.supabase as any)
      .from("product_layouts").select("*").eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });

export const productLayoutUpsertFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => layoutInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.is_default) {
      await (context.supabase as any).from("product_layouts")
        .update({ is_default: false }).neq("id", data.id ?? "00000000-0000-0000-0000-000000000000");
    }
    const { data: row, error } = await (context.supabase as any)
      .from("product_layouts").upsert(data).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const productLayoutDeleteFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await (context.supabase as any)
      .from("product_layouts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const productLayoutDuplicateFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sb = context.supabase as any;
    const { data: src, error } = await sb.from("product_layouts").select("*").eq("id", data.id).single();
    if (error) throw new Error(error.message);
    const { id, created_at, updated_at, ...rest } = src;
    const { data: row, error: insErr } = await sb.from("product_layouts")
      .insert({ ...rest, name: `${rest.name} (Copy)`, is_default: false, status: "draft" })
      .select().single();
    if (insErr) throw new Error(insErr.message);
    const { data: secs } = await sb.from("product_layout_sections").select("*").eq("layout_id", data.id);
    if (secs?.length) {
      const cloned = (secs as any[]).map(({ id, layout_id, created_at, updated_at, ...s }) => ({
        ...s, layout_id: row.id,
      }));
      await sb.from("product_layout_sections").insert(cloned);
    }
    return row;
  });

export const productLayoutPublishFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; publish: boolean }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await (context.supabase as any)
      .from("product_layouts")
      .update({ status: data.publish ? "published" : "draft" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ SECTIONS ============
export const productLayoutSectionsListFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { layout_id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: rows, error } = await (context.supabase as any)
      .from("product_layout_sections").select("*")
      .eq("layout_id", data.layout_id)
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const productLayoutSectionUpsertFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => sectionInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: row, error } = await (context.supabase as any)
      .from("product_layout_sections").upsert(data).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const productLayoutSectionDeleteFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await (context.supabase as any)
      .from("product_layout_sections").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const productLayoutSectionReorderFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { items: Array<{ id: string; sort_order: number }> }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    for (const it of data.items) {
      const { error } = await (context.supabase as any)
        .from("product_layout_sections")
        .update({ sort_order: it.sort_order }).eq("id", it.id);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const productLayoutSectionDuplicateFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sb = context.supabase as any;
    const { data: src, error } = await sb.from("product_layout_sections").select("*").eq("id", data.id).single();
    if (error) throw new Error(error.message);
    const { id, created_at, updated_at, ...rest } = src;
    const { data: row, error: insErr } = await sb.from("product_layout_sections")
      .insert({ ...rest, section_key: `${rest.section_key}-copy-${Date.now().toString(36)}`, sort_order: (rest.sort_order ?? 0) + 1 })
      .select().single();
    if (insErr) throw new Error(insErr.message);
    return row;
  });

// ============ PRODUCT ASSIGNMENT ============
export const productAssignLayoutFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { product_id: string; layout_id: string | null }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await (context.supabase as any)
      .from("products").update({ layout_id: data.layout_id }).eq("id", data.product_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ PUBLIC READ ============
// Resolves the layout that should render for a product (product's layout_id, else default).
export const productLayoutPublicResolveFn = createServerFn({ method: "GET" })
  .inputValidator((d: { product_id: string }) => d)
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const sb: any = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
    );
    const { data: product } = await sb.from("products").select("layout_id").eq("id", data.product_id).maybeSingle();
    let layoutId: string | null = product?.layout_id ?? null;
    if (!layoutId) {
      const { data: def } = await sb.from("product_layouts")
        .select("id").eq("is_default", true).eq("status", "published").eq("enabled", true).maybeSingle();
      layoutId = def?.id ?? null;
    }
    if (!layoutId) return null;
    const { data: layout } = await sb.from("product_layouts")
      .select("*").eq("id", layoutId).eq("status", "published").eq("enabled", true).maybeSingle();
    if (!layout) return null;
    const { data: sections } = await sb.from("product_layout_sections")
      .select("*").eq("layout_id", layoutId).eq("enabled", true).order("sort_order", { ascending: true });
    return { layout, sections: sections ?? [] };
  });
