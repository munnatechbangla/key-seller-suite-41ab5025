import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

export const getLandingPage = createServerFn({ method: "GET" })
  .inputValidator((data) => z.string().parse(data))
  .handler(async ({ data: slug }) => {
    const { data, error } = await supabase
      .from("landing_pages")
      .select("*")
      .eq("slug", slug)
      .eq("is_active", true)
      .single();

    if (error) throw error;
    return data;
  });

export const getLandingPageSections = createServerFn({ method: "GET" })
  .inputValidator((data) => z.string().parse(data))
  .handler(async ({ data: pageId }) => {
    const { data, error } = await supabase
      .from("landing_page_sections")
      .select("*")
      .eq("page_id", pageId)
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (error) throw error;
    return data;
  });

export const adminListLandingPages = createServerFn({ method: "GET" })
  .handler(async () => {
    const { data, error } = await supabase
      .from("landing_pages")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data;
  });

export const adminUpsertLandingPage = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({
    id: z.string().optional(),
    slug: z.string(),
    title: z.string(),
    content: z.any().optional(),
    is_active: z.boolean().optional(),
  }).parse(data))
  .handler(async ({ data }) => {
    const { data: page, error } = await supabase
      .from("landing_pages")
      .upsert({
        id: data.id || undefined,
        slug: data.slug,
        title: data.title,
        content: data.content || [],
        is_active: data.is_active ?? true,
        updated_at: new Date().toISOString(),
      } as any)
      .select()
      .single();

    if (error) throw error;
    return page;
  });

export const adminUpsertLandingSection = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({
    id: z.string().optional(),
    page_id: z.string(),
    section_key: z.string(),
    section_type: z.string(),
    title: z.string().optional().nullable(),
    json_content: z.any().optional(),
    sort_order: z.number().optional(),
    is_active: z.boolean().optional(),
  }).parse(data))
  .handler(async ({ data }) => {
    const { data: section, error } = await supabase
      .from("landing_page_sections")
      .upsert({
        id: data.id || undefined,
        page_id: data.page_id,
        section_key: data.section_key,
        section_type: data.section_type,
        title: data.title,
        json_content: data.json_content || {},
        sort_order: data.sort_order || 0,
        is_active: data.is_active ?? true,
      } as any)
      .select()
      .single();

    if (error) throw error;
    return section;
  });

export const adminDeleteLandingPage = createServerFn({ method: "POST" })
  .inputValidator((data) => z.string().parse(data))
  .handler(async ({ data: id }) => {
    const { error } = await supabase
      .from("landing_pages")
      .delete()
      .eq("id", id);

    if (error) throw error;
    return { success: true };
  });
