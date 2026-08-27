import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await (context.supabase as any).rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

// ============ PAGES ============
const pageInput = z.object({
  id: z.string().uuid().optional(),
  slug: z.string().min(1),
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  page_type: z.string().default("custom"),
  status: z.enum(["draft", "published"]).default("draft"),
  meta_title: z.string().nullable().optional(),
  meta_description: z.string().nullable().optional(),
  og_title: z.string().nullable().optional(),
  og_description: z.string().nullable().optional(),
  og_image: z.string().nullable().optional(),
  canonical_url: z.string().nullable().optional(),
  robots: z.string().nullable().optional(),
  theme: z.record(z.any()).optional(),
});

export const landingListPagesFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await (context.supabase as any)
      .from("landing_pages")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const landingGetPageFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: page, error } = await (context.supabase as any)
      .from("landing_pages").select("*").eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    return page;
  });

export const landingUpsertPageFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => pageInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const payload: any = {
      ...data,
      published_at: data.status === "published" ? new Date().toISOString() : null,
    };
    const { data: row, error } = await (context.supabase as any)
      .from("landing_pages").upsert(payload).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const landingDeletePageFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await (context.supabase as any).from("landing_pages").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const landingPublishPageFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; publish: boolean }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await (context.supabase as any)
      .from("landing_pages")
      .update({
        status: data.publish ? "published" : "draft",
        published_at: data.publish ? new Date().toISOString() : null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const landingDuplicatePageFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sb = (context.supabase as any);
    const { data: src, error } = await sb.from("landing_pages").select("*").eq("id", data.id).single();
    if (error) throw new Error(error.message);
    const { id, created_at, updated_at, published_at, ...rest } = src as any;
    const dup = {
      ...rest,
      slug: `${rest.slug}-copy-${Date.now().toString(36)}`,
      title: `${rest.title} (Copy)`,
      status: "draft",
    };
    const { data: row, error: e2 } = await sb.from("landing_pages").insert(dup).select().single();
    if (e2) throw new Error(e2.message);
    const { data: secs } = await sb.from("landing_page_sections").select("*").eq("page_id", data.id);
    if (secs?.length) {
      const clone = (secs as any[]).map(({ id, page_id, created_at, updated_at, ...s }) => ({
        ...s, page_id: row.id,
      }));
      await sb.from("landing_page_sections").insert(clone);
    }
    return row;
  });

// ============ SECTIONS ============
const sectionInput = z.object({
  id: z.string().uuid().optional(),
  page_id: z.string().uuid(),
  section_key: z.string().min(1),
  section_type: z.string().min(1),
  title: z.string().nullable().optional(),
  subtitle: z.string().nullable().optional(),
  json_content: z.any().optional(),
  sort_order: z.number().default(0),
  enabled: z.boolean().default(true),
});

export const landingListSectionsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { page_id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: rows, error } = await (context.supabase as any)
      .from("landing_page_sections")
      .select("*")
      .eq("page_id", data.page_id)
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const landingUpsertSectionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => sectionInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: row, error } = await (context.supabase as any)
      .from("landing_page_sections").upsert(data).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const landingDeleteSectionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await (context.supabase as any).from("landing_page_sections").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const landingReorderSectionsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { items: Array<{ id: string; sort_order: number }> }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    for (const it of data.items) {
      const { error } = await (context.supabase as any)
        .from("landing_page_sections")
        .update({ sort_order: it.sort_order })
        .eq("id", it.id);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

// ============ TEMPLATES ============
const templateInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  page_type: z.string().default("custom"),
  preview_image: z.string().nullable().optional(),
  json_content: z.any().optional(),
});

export const landingListTemplatesFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await (context.supabase as any)
      .from("landing_page_templates")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const landingUpsertTemplateFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => templateInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: row, error } = await (context.supabase as any)
      .from("landing_page_templates").upsert(data).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const landingDeleteTemplateFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await (context.supabase as any).from("landing_page_templates").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const landingSaveAsTemplateFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { page_id: string; name: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sb = (context.supabase as any);
    const { data: page } = await sb.from("landing_pages").select("*").eq("id", data.page_id).single();
    const { data: sections } = await sb.from("landing_page_sections").select("*").eq("page_id", data.page_id).order("sort_order");
    const json_content = {
      page: page ? { page_type: (page as any).page_type, theme: (page as any).theme } : {},
      sections: (sections ?? []).map((s: any) => ({
        section_key: s.section_key, section_type: s.section_type,
        title: s.title, subtitle: s.subtitle, json_content: s.json_content,
        sort_order: s.sort_order, enabled: s.enabled,
      })),
    };
    const { data: row, error } = await sb.from("landing_page_templates")
      .insert({ name: data.name, page_type: (page as any)?.page_type ?? "custom", json_content })
      .select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const landingApplyTemplateFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { page_id: string; template_id: string; replace: boolean }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sb = (context.supabase as any);
    const { data: tpl, error } = await sb.from("landing_page_templates").select("json_content").eq("id", data.template_id).single();
    if (error) throw new Error(error.message);
    if (data.replace) {
      await sb.from("landing_page_sections").delete().eq("page_id", data.page_id);
    }
    const secs = ((tpl as any)?.json_content?.sections ?? []) as any[];
    if (secs.length) {
      const rows = secs.map((s, i) => ({
        page_id: data.page_id,
        section_key: `${s.section_key ?? s.section_type}-${Date.now().toString(36)}-${i}`,
        section_type: s.section_type,
        title: s.title ?? null,
        subtitle: s.subtitle ?? null,
        json_content: s.json_content ?? {},
        sort_order: s.sort_order ?? i,
        enabled: s.enabled ?? true,
      }));
      await sb.from("landing_page_sections").insert(rows);
    }
    return { ok: true };
  });

// ============ PUBLIC ============
export const landingPublicGetBySlugFn = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) => d)
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
    );
    const { data: page } = await sb
      .from("landing_pages")
      .select("*")
      .eq("slug", data.slug)
      .eq("status", "published")
      .maybeSingle();
    if (!page) return null;
    const { data: sections } = await sb
      .from("landing_page_sections")
      .select("*")
      .eq("page_id", (page as any).id)
      .eq("enabled", true)
      .order("sort_order", { ascending: true });
    return { page, sections: sections ?? [] };
  });
