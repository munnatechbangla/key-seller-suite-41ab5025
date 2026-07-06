import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId, _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

const SEO_COLUMNS = [
  "meta_title", "meta_description", "focus_keyword", "secondary_keywords",
  "canonical_url", "robots",
  "og_title", "og_description", "og_image",
  "twitter_title", "twitter_description", "twitter_image",
  "schema_enabled", "faq_schema_enabled", "breadcrumb_schema_enabled", "product_schema_enabled",
] as const;

const seoInput = z.object({
  product_id: z.string().uuid(),
  meta_title: z.string().max(255).nullable().optional(),
  meta_description: z.string().max(500).nullable().optional(),
  focus_keyword: z.string().max(120).nullable().optional(),
  secondary_keywords: z.array(z.string()).optional(),
  canonical_url: z.string().url().nullable().optional().or(z.literal("").transform(() => null)),
  robots: z.string().max(60).nullable().optional(),
  og_title: z.string().max(255).nullable().optional(),
  og_description: z.string().max(500).nullable().optional(),
  og_image: z.string().nullable().optional(),
  twitter_title: z.string().max(255).nullable().optional(),
  twitter_description: z.string().max(500).nullable().optional(),
  twitter_image: z.string().nullable().optional(),
  schema_enabled: z.boolean().optional(),
  faq_schema_enabled: z.boolean().optional(),
  breadcrumb_schema_enabled: z.boolean().optional(),
  product_schema_enabled: z.boolean().optional(),
});

export const productSeoGetFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { product_id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: row, error } = await (context.supabase as any)
      .from("products")
      .select(["id", "slug", "title", ...SEO_COLUMNS].join(","))
      .eq("id", data.product_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });

export const productSeoUpdateFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => seoInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { product_id, ...patch } = data;
    const { error } = await (context.supabase as any)
      .from("products").update(patch).eq("id", product_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
