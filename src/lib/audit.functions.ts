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

const listSchema = z.object({
  search: z.string().optional(),
  action: z.string().optional(),
  entityType: z.string().optional(),
  limit: z.number().int().min(1).max(1000).default(200),
});

export const adminListAuditLogsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => listSchema.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    let q = context.supabase
      .from("audit_logs")
      .select("id, actor_email, action, entity_type, entity_id, metadata, ip_address, created_at")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.action) q = q.eq("action", data.action);
    if (data.entityType) q = q.eq("entity_type", data.entityType);
    if (data.search) {
      const term = `%${data.search}%`;
      q = q.or(
        `actor_email.ilike.${term},entity_id.ilike.${term},action.ilike.${term}`,
      );
    }
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows ?? [];
  });

export const adminExportAuditLogsCsvFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
      .from("audit_logs")
      .select("created_at, actor_email, action, entity_type, entity_id, ip_address, metadata")
      .order("created_at", { ascending: false })
      .limit(5000);
    if (error) throw error;
    const headers = ["created_at", "actor_email", "action", "entity_type", "entity_id", "ip_address", "metadata"];
    const escape = (v: unknown) => {
      if (v == null) return "";
      const s = typeof v === "string" ? v : JSON.stringify(v);
      return `"${s.replace(/"/g, '""')}"`;
    };
    const lines = [headers.join(",")];
    for (const r of data ?? []) {
      lines.push(headers.map((h) => escape((r as any)[h])).join(","));
    }
    return { csv: lines.join("\n") };
  });
