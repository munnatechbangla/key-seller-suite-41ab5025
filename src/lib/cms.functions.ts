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

// ============ PAGES ============
const pageInput = z.object({
  id: z.string().uuid().optional(),
  slug: z.string().min(1),
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  featured_image: z.string().nullable().optional(),
  excerpt: z.string().nullable().optional(),
  body_html: z.string().nullable().optional(),
  template: z.string().default("default"),
  meta_title: z.string().nullable().optional(),
  meta_description: z.string().nullable().optional(),
  og_title: z.string().nullable().optional(),
  og_description: z.string().nullable().optional(),
  og_image: z.string().nullable().optional(),
  canonical_url: z.string().nullable().optional(),
  robots: z.string().nullable().optional(),
  page_type: z.string().default("standard"),
  status: z.enum(["draft", "published"]).default("draft"),
  show_in_header: z.boolean().default(false),
  show_in_footer: z.boolean().default(false),
  menu_order: z.number().default(0),
  open_new_tab: z.boolean().default(false),
});

export const cmsListPagesFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
      .from("cms_pages")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const cmsGetPageFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: page, error } = await context.supabase
      .from("cms_pages")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return page;
  });

export const cmsUpsertPageFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => pageInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const payload = {
      ...data,
      published_at: data.status === "published" ? new Date().toISOString() : null,
    };
    const { data: row, error } = await context.supabase
      .from("cms_pages")
      .upsert(payload)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const cmsDeletePageFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("cms_pages").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const cmsDuplicatePageFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sb = context.supabase;
    const { data: src, error } = await sb.from("cms_pages").select("*").eq("id", data.id).single();
    if (error) throw new Error(error.message);
    const { id, created_at, updated_at, published_at, ...rest } = src as any;
    const dup = {
      ...rest,
      slug: `${rest.slug}-copy-${Date.now().toString(36)}`,
      title: `${rest.title} (Copy)`,
      status: "draft",
    };
    const { data: row, error: insErr } = await sb.from("cms_pages").insert(dup).select().single();
    if (insErr) throw new Error(insErr.message);
    // duplicate sections
    const { data: secs } = await sb.from("cms_sections").select("*").eq("page_id", data.id);
    if (secs?.length) {
      const cloned = (secs as any[]).map(({ id, page_id, created_at, updated_at, ...s }) => ({
        ...s,
        page_id: row.id,
      }));
      await sb.from("cms_sections").insert(cloned);
    }
    return row;
  });

export const cmsPublishPageFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; publish: boolean }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("cms_pages")
      .update({
        status: data.publish ? "published" : "draft",
        published_at: data.publish ? new Date().toISOString() : null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const legalPageInput = z.object({
  slug: z.enum(["about", "contact", "faq", "support", "track-order", "privacy", "terms", "refund"]),
  title: z.string().min(1),
  subtitle: z.string().nullable().optional(),
  content: z.record(z.string(), z.unknown()).default({}),
  is_published: z.boolean().default(true),
  seo_title: z.string().nullable().optional(),
  seo_description: z.string().nullable().optional(),
});

export const cmsGetBuiltInPageFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { slug: string }) => ({ slug: d.slug }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: page, error } = await context.supabase
      .from("legal_pages")
      .select("*")
      .eq("slug", data.slug)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return page;
  });

export const cmsUpsertBuiltInPageFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => legalPageInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: existing, error: readError } = await context.supabase
      .from("legal_pages")
      .select("id")
      .eq("slug", data.slug)
      .maybeSingle();
    if (readError) throw new Error(readError.message);

    if (existing?.id) {
      const { data: row, error } = await context.supabase
        .from("legal_pages")
        .update(data)
        .eq("id", existing.id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return row;
    }

    const { data: row, error } = await context.supabase
      .from("legal_pages")
      .insert(data)
      .select()
      .single();
    if (error) throw new Error(error.message);
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

export const cmsListSectionsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { page_id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: rows, error } = await context.supabase
      .from("cms_sections")
      .select("*")
      .eq("page_id", data.page_id)
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const cmsUpsertSectionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => sectionInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: row, error } = await context.supabase
      .from("cms_sections")
      .upsert(data)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const cmsDeleteSectionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("cms_sections").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ NAVIGATION ============
const navInput = z.object({
  id: z.string().uuid().optional(),
  menu_name: z.string().min(1),
  label: z.string().min(1),
  url: z.string().default("#"),
  icon: z.string().nullable().optional(),
  target: z.string().default("_self"),
  parent_id: z.string().uuid().nullable().optional(),
  sort_order: z.number().default(0),
  enabled: z.boolean().default(true),
});

export const cmsListMenuFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { menu_name: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: rows, error } = await context.supabase
      .from("cms_navigation")
      .select("*")
      .eq("menu_name", data.menu_name)
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const cmsUpsertMenuItemFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => navInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: row, error } = await context.supabase
      .from("cms_navigation")
      .upsert(data)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const cmsDeleteMenuItemFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("cms_navigation").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const cmsReorderMenuFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { items: Array<{ id: string; sort_order: number; parent_id: string | null }> }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    for (const it of data.items) {
      const { error } = await context.supabase
        .from("cms_navigation")
        .update({ sort_order: it.sort_order, parent_id: it.parent_id })
        .eq("id", it.id);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

// ============ FOOTER ============
const footerInput = z.object({
  id: z.string().uuid().optional(),
  section_name: z.string().min(1),
  json_content: z.any().optional(),
  sort_order: z.number().default(0),
  enabled: z.boolean().default(true),
});

export const cmsListFooterFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
      .from("cms_footer")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const cmsUpsertFooterFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => footerInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: row, error } = await context.supabase
      .from("cms_footer")
      .upsert(data)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const cmsDeleteFooterFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("cms_footer").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ PUBLIC READS (no auth) ============
export const cmsPublicGetPageBySlugFn = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) => d)
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
    );
    const { data: page } = await sb
      .from("cms_pages")
      .select("*")
      .eq("slug", data.slug)
      .eq("status", "published")
      .maybeSingle();
    if (!page) return null;
    const { data: sections } = await sb
      .from("cms_sections")
      .select("*")
      .eq("page_id", (page as any).id)
      .eq("enabled", true)
      .order("sort_order", { ascending: true });
    return { page, sections: sections ?? [] };
  });

export const cmsPublicGetMenuFn = createServerFn({ method: "GET" })
  .inputValidator((d: { menu_name: string }) => d)
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
    );
    const { data: rows } = await sb
      .from("cms_navigation")
      .select("*")
      .eq("menu_name", data.menu_name)
      .eq("enabled", true)
      .order("sort_order", { ascending: true });
    return rows ?? [];
  });

export const cmsPublicGetFooterFn = createServerFn({ method: "GET" })
  .handler(async () => {
    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
    );
    const { data } = await sb
      .from("cms_footer")
      .select("*")
      .eq("enabled", true)
      .order("sort_order", { ascending: true });
    return data ?? [];
  });

// ============ HOMEPAGE HELPERS ============
export const cmsGetOrCreateHomePageFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const sb = context.supabase;
    const { data: existing } = await sb.from("cms_pages").select("*").eq("slug", "home").maybeSingle();
    if (existing) return existing;
    const { data: created, error } = await sb
      .from("cms_pages")
      .insert({ slug: "home", title: "Homepage", page_type: "homepage", status: "draft" })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return created;
  });

export const cmsReorderSectionsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { items: Array<{ id: string; sort_order: number }> }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    for (const it of data.items) {
      const { error } = await context.supabase
        .from("cms_sections")
        .update({ sort_order: it.sort_order })
        .eq("id", it.id);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const cmsDuplicateSectionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sb = context.supabase;
    const { data: src, error } = await sb.from("cms_sections").select("*").eq("id", data.id).single();
    if (error) throw new Error(error.message);
    const { id, created_at, updated_at, ...rest } = src as any;
    const { data: row, error: insErr } = await sb
      .from("cms_sections")
      .insert({ ...rest, section_key: `${rest.section_key}-copy-${Date.now().toString(36)}`, sort_order: (rest.sort_order ?? 0) + 1 })
      .select()
      .single();
    if (insErr) throw new Error(insErr.message);
    return row;
  });


// ============ PUBLIC NAV PAGES (no auth) ============
export const cmsPublicListNavPagesFn = createServerFn({ method: "GET" })
  .handler(async () => {
    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
    );
    const { data } = await sb
      .from("cms_pages")
      .select("slug,title,show_in_header,show_in_footer,menu_order,open_new_tab")
      .eq("status", "published")
      .or("show_in_header.eq.true,show_in_footer.eq.true")
      .order("menu_order", { ascending: true });
    return (data ?? []) as Array<{
      slug: string; title: string; show_in_header: boolean;
      show_in_footer: boolean; menu_order: number; open_new_tab: boolean;
    }>;
  });
