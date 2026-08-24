import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Public functions
export const landingPublicGetBySlugFn = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ slug: z.string() }).parse(data))
  .handler(async ({ data: { slug } }) => {
    const { data: page, error: pageErr } = await supabase
      .from("landing_pages")
      .select("*")
      .eq("slug", slug)
      .eq("is_active", true)
      .single();

    if (pageErr) return null;

    const { data: sections, error: secErr } = await supabase
      .from("landing_page_sections")
      .select("*")
      .eq("page_id", page.id)
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    return { page, sections: sections || [] };
  });

// Admin functions
export const landingListPagesFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { data, error } = await supabase.from("landing_pages").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  });

export const landingGetPageFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data: { id } }) => {
    const { data, error } = await supabase.from("landing_pages").select("*").eq("id", id).single();
    if (error) throw error;
    return data;
  });

export const landingUpsertPageFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.any().parse(data))
  .handler(async ({ data }) => {
    const { data: page, error } = await supabase
      .from("landing_pages")
      .upsert({ ...data, updated_at: new Date().toISOString() })
      .select()
      .single();
    if (error) throw error;
    return page;
  });

export const landingDeletePageFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data: { id } }) => {
    const { error } = await supabase.from("landing_pages").delete().eq("id", id);
    if (error) throw error;
    return { success: true };
  });

export const landingDuplicatePageFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data: { id } }) => {
    const { data: page, error } = await supabase.from("landing_pages").select("*").eq("id", id).single();
    if (error) throw error;
    const { data: newPage, error: err2 } = await supabase
      .from("landing_pages")
      .insert({ ...page, id: undefined, slug: `${page.slug}-copy`, title: `${page.title} (Copy)` })
      .select()
      .single();
    if (err2) throw err2;
    return newPage;
  });

export const landingPublishPageFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string(), published: z.boolean() }).parse(data))
  .handler(async ({ data }) => {
    const { error } = await supabase.from("landing_pages").update({ is_active: data.published }).eq("id", data.id);
    if (error) throw error;
    return { success: true };
  });

export const landingListSectionsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ pageId: z.string() }).parse(data))
  .handler(async ({ data: { pageId } }) => {
    const { data, error } = await supabase
      .from("landing_page_sections")
      .select("*")
      .eq("page_id", pageId)
      .order("sort_order", { ascending: true });
    if (error) throw error;
    return data;
  });

export const landingUpsertSectionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.any().parse(data))
  .handler(async ({ data }) => {
    const { data: sec, error } = await supabase.from("landing_page_sections").upsert(data).select().single();
    if (error) throw error;
    return sec;
  });

export const landingDeleteSectionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data: { id } }) => {
    const { error } = await supabase.from("landing_page_sections").delete().eq("id", id);
    if (error) throw error;
    return { success: true };
  });

export const landingReorderSectionsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.array(z.object({ id: z.string(), sort_order: z.number() })).parse(data))
  .handler(async ({ data }) => {
    for (const item of data) {
      await supabase.from("landing_page_sections").update({ sort_order: item.sort_order }).eq("id", item.id);
    }
    return { success: true };
  });

export const landingListTemplatesFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    return [];
  });

export const landingSaveAsTemplateFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ pageId: z.string(), name: z.string() }).parse(data))
  .handler(async ({ data }) => {
    return { success: true, id: 'temp-id' };
  });

export const landingApplyTemplateFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ pageId: z.string(), templateId: z.string() }).parse(data))
  .handler(async ({ data }) => {
    return { success: true };
  });

