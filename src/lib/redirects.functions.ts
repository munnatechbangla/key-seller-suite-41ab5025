import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId, _role: "admin",
  });
  if (error || !data) throw new Error("Forbidden");
}

const redirectInput = z.object({
  id: z.string().uuid().optional(),
  source_path: z.string().min(1),
  target_path: z.string().min(1),
  status_code: z.number().int().refine((n) => n === 301 || n === 302 || n === 410),
  note: z.string().nullable().optional(),
  enabled: z.boolean().default(true),
});

export const redirectsListFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await (context.supabase as any)
      .from("redirects").select("*").order("source_path", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const redirectUpsertFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => redirectInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const payload = { ...data };
    const q: any = context.supabase.from("redirects");
    const { error } = data.id
      ? await q.update(payload).eq("id", data.id)
      : await q.insert(payload);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const redirectDeleteFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await (context.supabase as any)
      .from("redirects").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
