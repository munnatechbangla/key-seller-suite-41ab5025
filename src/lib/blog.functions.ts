import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function pubClient() {
  return createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

// -------- Public reads --------
export const blogListPublicFn = createServerFn({ method: "GET" })
  .inputValidator((d: { post_type?: string; category_slug?: string; limit?: number } | undefined) => d ?? {})
  .handler(async ({ data }) => {
    const sb = pubClient();
    let q = sb.from("blog_posts").select("*").eq("status", "published").order("published_at", { ascending: false }).limit(data.limit ?? 100);
    if (data.post_type) q = q.eq("post_type", data.post_type);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const blogGetBySlugPublicFn = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) => d)
  .handler(async ({ data }) => {
    const sb = pubClient();
    const { data: row, error } = await sb.from("blog_posts").select("*").eq("slug", data.slug).eq("status", "published").maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });

export const blogListCategoriesPublicFn = createServerFn({ method: "GET" })
  .inputValidator((d: { kind?: string } | undefined) => d ?? {})
  .handler(async ({ data }) => {
    const sb = pubClient();
    let q = sb.from("blog_categories").select("*").order("sort_order");
    if (data.kind) q = q.eq("kind", data.kind);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// -------- Admin CRUD --------
export const blogAdminListFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("blog_posts").select("*").order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const blogAdminUpsertFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Record<string, unknown>) => d)
  .handler(async ({ data, context }) => {
    const row = { ...data } as Record<string, unknown>;
    if (row.status === "published" && !row.published_at) row.published_at = new Date().toISOString();
    if (!row.id) delete row.id;
    const { data: saved, error } = await context.supabase.from("blog_posts").upsert(row as never).select().single();
    if (error) throw new Error(error.message);
    return saved;
  });

export const blogAdminDeleteFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("blog_posts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const blogAdminListCommentsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("blog_comments").select("*").order("created_at", { ascending: false }).limit(500);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const blogAdminModerateCommentFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; status: "approved" | "pending" | "spam" | "trash" }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("blog_comments").update({ status: data.status }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const blogSubmitCommentFn = createServerFn({ method: "POST" })
  .inputValidator((d: { post_id: string; body: string; guest_name?: string; guest_email?: string; parent_id?: string }) => d)
  .handler(async ({ data }) => {
    const sb = pubClient();
    const { error } = await sb.from("blog_comments").insert({
      post_id: data.post_id,
      body: data.body,
      guest_name: data.guest_name ?? null,
      guest_email: data.guest_email ?? null,
      parent_id: data.parent_id ?? null,
      status: "pending",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// -------- Category admin --------
export const blogAdminListCategoriesFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("blog_categories").select("*").order("sort_order").order("name");
    if (error) throw new Error(error.message);
    const cats = data ?? [];
    const { data: counts } = await context.supabase.from("blog_posts").select("category_id");
    const map = new Map<string, number>();
    (counts ?? []).forEach((r: { category_id: string | null }) => {
      if (r.category_id) map.set(r.category_id, (map.get(r.category_id) ?? 0) + 1);
    });
    return cats.map((c) => ({ ...c, post_count: map.get(c.id) ?? 0 }));
  });

export const blogAdminUpsertCategoryFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Record<string, unknown>) => d)
  .handler(async ({ data, context }) => {
    const row = { ...data } as Record<string, unknown>;
    if (!row.id) delete row.id;
    if (!row.kind) row.kind = "blog";
    const { data: saved, error } = await context.supabase.from("blog_categories").upsert(row as never).select().single();
    if (error) throw new Error(error.message);
    return saved;
  });

export const blogAdminDeleteCategoryFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("blog_categories").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// -------- Tag admin --------
export const blogAdminListTagsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("blog_tags").select("*").order("name");
    if (error) throw new Error(error.message);
    const tags = data ?? [];
    const { data: posts } = await context.supabase.from("blog_posts").select("tag_ids");
    const map = new Map<string, number>();
    (posts ?? []).forEach((p: { tag_ids: string[] | null }) => {
      (p.tag_ids ?? []).forEach((t) => map.set(t, (map.get(t) ?? 0) + 1));
    });
    return tags.map((t) => ({ ...t, post_count: map.get(t.id) ?? 0 }));
  });

export const blogAdminUpsertTagFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id?: string; name: string; slug: string }) => d)
  .handler(async ({ data, context }) => {
    const row: Record<string, unknown> = { name: data.name, slug: data.slug };
    if (data.id) row.id = data.id;
    const { data: saved, error } = await context.supabase.from("blog_tags").upsert(row as never).select().single();
    if (error) throw new Error(error.message);
    return saved;
  });

export const blogAdminDeleteTagFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("blog_tags").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

