import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const submitSchema = z.object({
  productId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().max(160).optional().nullable(),
  body: z.string().trim().max(4000).optional().nullable(),
  orderItemId: z.string().uuid().optional().nullable(),
  displayName: z.string().trim().max(80).optional().nullable(),
});

const updateSchema = z.object({
  id: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().max(160).optional().nullable(),
  body: z.string().trim().max(4000).optional().nullable(),
});

// ----- Customer-facing -----

export const submitReviewFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => submitSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Anti-spam: simple cooldown (max 1 submission per 30 seconds per user)
    const since = new Date(Date.now() - 30_000).toISOString();
    const { count: recent } = await supabase
      .from("product_reviews")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", since);
    if ((recent ?? 0) > 0) throw new Error("Please wait a moment before submitting another review.");

    // Verified purchase check (and one-review-per-product guard)
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: purchased } = await supabaseAdmin.rpc("user_purchased_product", {
      _user_id: userId,
      _product_id: data.productId,
    });
    const isVerified = Boolean(purchased);

    // One review per product per user
    const { data: existing } = await supabase
      .from("product_reviews")
      .select("id")
      .eq("user_id", userId)
      .eq("product_id", data.productId)
      .maybeSingle();
    if (existing) throw new Error("You have already reviewed this product. Edit your existing review instead.");

    // If orderItemId provided, validate ownership and one-per-item uniqueness
    if (data.orderItemId) {
      const { data: oi } = await supabaseAdmin
        .from("order_items")
        .select("id, product_id, order_id, orders!inner(user_id, status)")
        .eq("id", data.orderItemId)
        .maybeSingle();
      const ord = (oi as unknown as { orders?: { user_id: string; status: string } } | null)?.orders;
      if (!oi || oi.product_id !== data.productId) throw new Error("Invalid order item.");
      if (!ord || ord.user_id !== userId) throw new Error("Order item does not belong to you.");
      if (!["paid", "completed"].includes(ord.status)) throw new Error("Order is not paid yet.");
    }

    const { data: inserted, error } = await supabase
      .from("product_reviews")
      .insert({
        product_id: data.productId,
        user_id: userId,
        rating: data.rating,
        title: data.title ?? null,
        body: data.body ?? null,
        order_item_id: data.orderItemId ?? null,
        display_name: data.displayName?.trim() || null,
        is_verified: isVerified,
        status: "pending",
      })
      .select("id, status")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: inserted.id, status: inserted.status, verified: isVerified };
  });

export const updateMyReviewFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => updateSchema.parse(d))
  .handler(async ({ data, context }) => {
    // Editing resets to pending for re-moderation
    const { error } = await context.supabase
      .from("product_reviews")
      .update({
        rating: data.rating,
        title: data.title ?? null,
        body: data.body ?? null,
        status: "pending",
      })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteMyReviewFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("product_reviews")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getMyReviewsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("product_reviews")
      .select("id, product_id, rating, title, body, status, is_verified, admin_reply, created_at, products(slug, title, thumbnail_url, emoji)")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getReviewableItemsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Items the user purchased (paid/completed) but hasn't reviewed yet
    const { data: items, error } = await context.supabase
      .from("order_items")
      .select("id, product_id, product_name, product_slug, created_at, orders!inner(status, user_id)")
      .eq("orders.user_id", context.userId)
      .in("orders.status", ["paid", "completed"])
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const { data: reviewed } = await context.supabase
      .from("product_reviews")
      .select("product_id")
      .eq("user_id", context.userId);
    const reviewedIds = new Set((reviewed ?? []).map((r) => r.product_id));
    return (items ?? []).filter((it) => !reviewedIds.has(it.product_id));
  });

// ----- Admin moderation -----

async function assertAdmin(supabase: import("@supabase/supabase-js").SupabaseClient, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Forbidden");
}

export const adminListReviewsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        status: z.enum(["all", "pending", "approved", "rejected"]).default("all"),
        search: z.string().trim().optional().default(""),
        limit: z.number().int().min(1).max(200).default(100),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("product_reviews")
      .select("id, product_id, user_id, rating, title, body, status, is_verified, admin_reply, admin_reply_at, display_name, created_at, products(slug, title), profiles:user_id(full_name, email)")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.status !== "all") q = q.eq("status", data.status);
    if (data.search) q = q.or(`title.ilike.%${data.search}%,body.ilike.%${data.search}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const adminSetReviewStatusFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        ids: z.array(z.string().uuid()).min(1),
        status: z.enum(["pending", "approved", "rejected"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("product_reviews")
      .update({ status: data.status })
      .in("id", data.ids);
    if (error) throw new Error(error.message);
    return { ok: true, count: data.ids.length };
  });

export const adminReplyReviewFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), reply: z.string().trim().max(2000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("product_reviews")
      .update({ admin_reply: data.reply || null, admin_reply_at: data.reply ? new Date().toISOString() : null })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteReviewFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("product_reviews").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
