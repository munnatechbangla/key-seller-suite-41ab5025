// Server-only audit logger. Uses SECURITY DEFINER RPC so it works without a
// service-role key. Never let audit logging break the underlying action.
export type AuditEntry = {
  actorId?: string | null;
  actorEmail?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    const { createServerSupabaseClient } = await import("@/integrations/supabase/server-client");
    const sb: any = createServerSupabaseClient();
    await sb.rpc("insert_audit_log", {
      _entry: {
        actor_id: entry.actorId ?? null,
        actor_email: entry.actorEmail ?? null,
        action: entry.action,
        entity_type: entry.entityType,
        entity_id: entry.entityId ?? null,
        metadata: entry.metadata ?? {},
        ip_address: entry.ipAddress ?? null,
        user_agent: entry.userAgent ?? null,
      },
    });
  } catch (err) {
    console.error("[audit] failed to record entry", err);
  }
}
