// Admin-only server functions for white-label settings management.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  if (error || !data) throw new Error("Forbidden");
}

export const adminListSettingsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
      .from("site_settings")
      .select("group_key, setting_key, value, is_public, updated_at")
      .order("group_key");
    if (error) throw error;
    return data ?? [];
  });

const upsertSchema = z.object({
  group_key: z.string().min(1),
  setting_key: z.string().min(1),
  value: z.record(z.any()),
});

export const adminUpsertSettingFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => upsertSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("site_settings")
      .upsert(
        { group_key: data.group_key, setting_key: data.setting_key, value: data.value },
        { onConflict: "group_key,setting_key" },
      );
    if (error) throw error;
    const { logAudit } = await import("./audit.server");
    await logAudit({
      actorId: context.userId,
      actorEmail: (context.claims as any)?.email ?? null,
      action: "settings.update",
      entityType: "site_settings",
      entityId: `${data.group_key}/${data.setting_key}`,
    });
    return { ok: true };
  });
