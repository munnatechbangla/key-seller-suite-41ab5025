import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { NOTIFICATION_CHANNELS, renderTemplate } from "./notifications/events";

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

const channelEnum = z.enum(NOTIFICATION_CHANNELS);
const statusEnum = z.enum(["pending", "processing", "sent", "failed", "cancelled"]);

// ---------- Templates ----------
export const listNotificationTemplatesFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await (context.supabase as any)
      .from("notification_templates")
      .select("*")
      .order("event_key", { ascending: true })
      .order("channel", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const templateInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  event_key: z.string().min(1),
  channel: channelEnum,
  subject: z.string().nullable().optional(),
  body: z.string().min(1),
  variables_json: z.array(z.string()).default([]),
  is_enabled: z.boolean().default(true),
});

export const upsertNotificationTemplateFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => templateInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const row = {
      name: data.name,
      event_key: data.event_key,
      channel: data.channel,
      subject: data.subject ?? null,
      body: data.body,
      variables_json: data.variables_json,
      is_enabled: data.is_enabled,
    };
    const q = (context.supabase as any).from("notification_templates");
    const { data: out, error } = data.id
      ? await q.update(row).eq("id", data.id).select().maybeSingle()
      : await q.insert(row).select().maybeSingle();
    if (error) throw new Error(error.message);
    return out;
  });

export const deleteNotificationTemplateFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await (context.supabase as any)
      .from("notification_templates")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const duplicateNotificationTemplateFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: src, error } = await (context.supabase as any)
      .from("notification_templates")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!src) throw new Error("Template not found");
    const { data: out, error: e2 } = await (context.supabase as any)
      .from("notification_templates")
      .insert({
        name: `${src.name} (copy)`,
        event_key: src.event_key,
        channel: src.channel,
        subject: src.subject,
        body: src.body,
        variables_json: src.variables_json,
        is_enabled: false,
      })
      .select()
      .maybeSingle();
    if (e2) throw new Error(e2.message);
    return out;
  });

export const previewNotificationTemplateFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        subject: z.string().nullable().optional(),
        body: z.string(),
        vars: z.record(z.any()).default({}),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    return {
      subject: data.subject ? renderTemplate(data.subject, data.vars) : null,
      body: renderTemplate(data.body, data.vars),
    };
  });

// ---------- Queue ----------
export const listNotificationQueueFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        status: statusEnum.optional(),
        limit: z.number().int().min(1).max(500).default(100),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    let q = (context.supabase as any)
      .from("notification_queue")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const enqueueInput = z.object({
  event_key: z.string().min(1),
  channel: channelEnum,
  recipient: z.string().min(1),
  payload: z.record(z.any()).default({}),
  scheduled_at: z.string().datetime().optional(),
  template_id: z.string().uuid().optional(),
});

export const enqueueNotificationFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => enqueueInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    // Find a template if not explicitly provided
    let template: any = null;
    if (data.template_id) {
      const { data: t } = await (context.supabase as any)
        .from("notification_templates")
        .select("*")
        .eq("id", data.template_id)
        .maybeSingle();
      template = t;
    } else {
      const { data: t } = await (context.supabase as any)
        .from("notification_templates")
        .select("*")
        .eq("event_key", data.event_key)
        .eq("channel", data.channel)
        .eq("is_enabled", true)
        .limit(1)
        .maybeSingle();
      template = t;
    }
    const rendered_subject = template?.subject
      ? renderTemplate(template.subject, data.payload)
      : null;
    const rendered_body = template?.body ? renderTemplate(template.body, data.payload) : "";
    const { data: row, error } = await (context.supabase as any)
      .from("notification_queue")
      .insert({
        event_key: data.event_key,
        channel: data.channel,
        recipient: data.recipient,
        payload_json: data.payload,
        scheduled_at: data.scheduled_at ?? new Date().toISOString(),
        template_id: template?.id ?? null,
        rendered_subject,
        rendered_body,
        status: "pending",
      })
      .select()
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });

export const sendNotificationFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: row, error } = await (context.supabase as any)
      .from("notification_queue")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Not found");
    const { getProvider } = await import("./notifications/providers");
    const provider = getProvider(row.channel);
    const res = await provider.send({
      channel: row.channel,
      recipient: row.recipient,
      subject: row.rendered_subject,
      body: row.rendered_body ?? "",
      payload: row.payload_json ?? {},
    });
    const patch = res.ok
      ? { status: "sent", sent_at: new Date().toISOString(), last_error: null }
      : {
          status: "failed",
          retry_count: (row.retry_count ?? 0) + 1,
          last_error: res.error,
        };
    await (context.supabase as any)
      .from("notification_queue")
      .update(patch)
      .eq("id", row.id);
    return { ok: res.ok, error: res.ok ? null : res.error };
  });

export const retryNotificationFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await (context.supabase as any)
      .from("notification_queue")
      .update({
        status: "pending",
        last_error: null,
        scheduled_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const cancelNotificationFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await (context.supabase as any)
      .from("notification_queue")
      .update({ status: "cancelled" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
