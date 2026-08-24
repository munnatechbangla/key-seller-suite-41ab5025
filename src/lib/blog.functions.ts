import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

export const getBlogPosts = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({
    category: z.string().optional(),
    tag: z.string().optional(),
    limit: z.number().optional().default(10),
  }).parse(data))
  .handler(async ({ data }) => {
    let query = supabase
      .from("blog_posts")
      .select("*, blog_categories(*)")
      .eq("status", "published")
      .order("published_at", { ascending: false });

    if (data.category) {
      query = query.eq("category_id", data.category);
    }

    const { data: posts, error } = await query.limit(data.limit);
    if (error) throw error;
    return posts;
  });

export const getBlogPost = createServerFn({ method: "GET" })
  .inputValidator((data) => z.string().parse(data))
  .handler(async ({ data: slug }) => {
    const { data, error } = await supabase
      .from("blog_posts")
      .select("*, blog_categories(*)")
      .eq("slug", slug)
      .eq("status", "published")
      .single();

    if (error) throw error;
    return data;
  });

export const adminListBlogPosts = createServerFn({ method: "GET" })
  .handler(async () => {
    const { data, error } = await supabase
      .from("blog_posts")
      .select("*, blog_categories(*)")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data;
  });

export const adminUpsertBlogPost = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({
    id: z.string().optional(),
    title: z.string(),
    slug: z.string(),
    content: z.string(),
    excerpt: z.string().optional().nullable(),
    featured_image: z.string().optional().nullable(),
    status: z.enum(["draft", "published"]),
    category_id: z.string().optional().nullable(),
    author_id: z.string().optional().nullable(),
  }).parse(data))
  .handler(async ({ data }) => {
    const { data: post, error } = await supabase
      .from("blog_posts")
      .upsert({
        id: data.id || undefined,
        title: data.title,
        slug: data.slug,
        content: data.content,
        excerpt: data.excerpt,
        featured_image: data.featured_image,
        status: data.status,
        category_id: data.category_id,
        author_id: data.author_id,
        updated_at: new Date().toISOString(),
        published_at: data.status === 'published' ? new Date().toISOString() : null,
      } as any)
      .select()
      .single();

    if (error) throw error;
    return post;
  });

export const getBlogCategories = createServerFn({ method: "GET" })
  .handler(async () => {
    const { data, error } = await supabase
      .from("blog_categories")
      .select("*")
      .order("name", { ascending: true });

    if (error) throw error;
    return data;
  });
