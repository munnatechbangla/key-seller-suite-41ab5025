import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Public functions
export const blogListPublicFn = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({
    post_type: z.enum(["blog", "kb", "docs", "tutorial", "changelog"]).optional().default("blog"),
    category_id: z.string().optional(),
    tag_id: z.string().optional(),
    limit: z.number().optional().default(100),
  }).parse(data))
  .handler(async ({ data }) => {
    let query = supabase
      .from("blog_posts")
      .select("*, blog_categories(id, name, slug)")
      .eq("status", "published")
      .order("published_at", { ascending: false });

    if (data.post_type) {
      // In new schema, we might use a post_type column or just filter by category/tag conventions.
      // Assuming a post_type column exists or was intended.
      query = query.eq("post_type" as any, data.post_type);
    }
    if (data.category_id) query = query.eq("category_id", data.category_id);

    const { data: posts, error } = await query.limit(data.limit);
    if (error) return [] as any[];
    
    // Mapping thumbnail_url to cover_url for compatibility
    return (posts || []).map(p => ({
      ...p,
      cover_url: p.thumbnail_url || (p as any).cover_url || null
    }));
  });

export const blogGetBySlugPublicFn = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ slug: z.string() }).parse(data))
  .handler(async ({ data: { slug } }) => {
    const { data, error } = await supabase
      .from("blog_posts")
      .select("*, blog_categories(*)")
      .eq("slug", slug)
      .eq("status", "published")
      .single();

    if (error) return null;
    return {
      ...data,
      cover_url: data.thumbnail_url || (data as any).cover_url || null
    };
  });

export const blogListCategoriesPublicFn = createServerFn({ method: "GET" })
  .handler(async () => {
    const { data, error } = await supabase
      .from("blog_categories")
      .select("*")
      .order("name", { ascending: true });
    return data || [];
  });

export const blogSubmitCommentFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({
    post_id: z.string(),
    content: z.string().min(1),
    parent_id: z.string().optional().nullable(),
  }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: comment, error } = await supabase
      .from("blog_comments" as any)
      .insert({
        post_id: data.post_id,
        content: data.content,
        parent_id: data.parent_id,
        author_id: context.userId,
      })
      .select()
      .single();
    if (error) throw error;
    return comment;
  });

// Admin functions
export const blogAdminListFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { data, error } = await supabase
      .from("blog_posts")
      .select("*, blog_categories(*)")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  });

export const blogAdminUpsertFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.any().parse(data))
  .handler(async ({ data }) => {
    const { data: post, error } = await supabase
      .from("blog_posts")
      .upsert({
        ...data,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) throw error;
    return post;
  });

export const blogAdminDeleteFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data: { id } }) => {
    const { error } = await supabase.from("blog_posts").delete().eq("id", id);
    if (error) throw error;
    return { success: true };
  });

export const blogAdminListCategoriesFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { data, error } = await supabase.from("blog_categories").select("*").order("name");
    if (error) throw error;
    return data;
  });

export const blogAdminUpsertCategoryFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.any().parse(data))
  .handler(async ({ data }) => {
    const { data: cat, error } = await supabase.from("blog_categories").upsert(data).select().single();
    if (error) throw error;
    return cat;
  });

export const blogAdminDeleteCategoryFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data: { id } }) => {
    const { error } = await supabase.from("blog_categories").delete().eq("id", id);
    if (error) throw error;
    return { success: true };
  });

export const blogAdminListTagsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { data, error } = await supabase.from("blog_tags" as any).select("*").order("name");
    return data || [];
  });

export const blogAdminUpsertTagFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.any().parse(data))
  .handler(async ({ data }) => {
    const { data: tag, error } = await supabase.from("blog_tags" as any).upsert(data).select().single();
    if (error) throw error;
    return tag;
  });

export const blogAdminDeleteTagFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data: { id } }) => {
    const { error } = await supabase.from("blog_tags" as any).delete().eq("id", id);
    if (error) throw error;
    return { success: true };
  });

export const blogAdminListCommentsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { data, error } = await supabase.from("blog_comments" as any).select("*, blog_posts(title)").order("created_at", { ascending: false });
    return data || [];
  });

export const blogAdminModerateCommentFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string(), status: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const { error } = await supabase.from("blog_comments" as any).update({ status: data.status }).eq("id", data.id);
    if (error) throw error;
    return { success: true };
  });
