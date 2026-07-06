import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

const fieldTypeEnum = z.enum([
  "text","email","number","url","password","textarea",
  "select","radio","checkbox","date","phone","country","hidden",
]);

const slugRegex = /^[a-z0-9_]+$/;

const fieldSchema = z.object({
  id: z.string().uuid().optional(),
  product_id: z.string().uuid(),
  label: z.string().trim().min(1).max(200),
  name: z.string().trim().min(1).max(64).regex(slugRegex, "Use lowercase letters, numbers, underscores"),
  field_type: fieldTypeEnum,
  placeholder: z.string().max(200).nullable().optional(),
  help_text: z.string().max(500).nullable().optional(),
  default_value: z.string().max(500).nullable().optional(),
  is_required: z.boolean().optional(),
  is_visible: z.boolean().optional(),
  is_enabled: z.boolean().optional(),
  sort_order: z.number().int().optional(),
  min_length: z.number().int().nonnegative().nullable().optional(),
  max_length: z.number().int().nonnegative().nullable().optional(),
  regex_pattern: z.string().max(500).nullable().optional(),
  admin_notes: z.string().max(1000).nullable().optional(),
});

export const listCustomFieldsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ product_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sb = context.supabase as any;
    const { data: fields, error } = await sb
      .from("product_custom_fields")
      .select("*")
      .eq("product_id", data.product_id)
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    const ids = (fields ?? []).map((f: any) => f.id);
    let options: any[] = [];
    if (ids.length) {
      const { data: opts, error: oe } = await sb
        .from("product_custom_field_options")
        .select("*")
        .in("field_id", ids)
        .order("sort_order", { ascending: true });
      if (oe) throw new Error(oe.message);
      options = opts ?? [];
    }
    return (fields ?? []).map((f: any) => ({
      ...f,
      options: options.filter((o) => o.field_id === f.id),
    }));
  });

export const upsertCustomFieldFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => fieldSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.min_length != null && data.max_length != null && data.min_length > data.max_length) {
      throw new Error("min_length cannot exceed max_length");
    }
    if (data.regex_pattern) {
      try { new RegExp(data.regex_pattern); } catch { throw new Error("Invalid regex pattern"); }
    }
    const sb = context.supabase as any;
    // Uniqueness check on (product_id, name)
    const { data: dup } = await sb
      .from("product_custom_fields")
      .select("id")
      .eq("product_id", data.product_id)
      .eq("name", data.name)
      .maybeSingle();
    if (dup && dup.id !== data.id) {
      throw new Error(`Internal name "${data.name}" is already used for this product`);
    }
    if (data.id) {
      const { error } = await sb.from("product_custom_fields").update(data).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    }
    const { data: row, error } = await sb
      .from("product_custom_fields")
      .insert(data)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: row.id };
  });

export const deleteCustomFieldFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await (context.supabase as any)
      .from("product_custom_fields")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const duplicateCustomFieldFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sb = context.supabase as any;
    const { data: src, error } = await sb
      .from("product_custom_fields")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);

    // find a unique name
    let base = `${src.name}_copy`;
    let candidate = base;
    let n = 1;
    while (true) {
      const { data: exists } = await sb
        .from("product_custom_fields")
        .select("id")
        .eq("product_id", src.product_id)
        .eq("name", candidate)
        .maybeSingle();
      if (!exists) break;
      n += 1;
      candidate = `${base}_${n}`;
    }

    const { id, created_at, updated_at, ...rest } = src;
    const { data: inserted, error: ie } = await sb
      .from("product_custom_fields")
      .insert({ ...rest, name: candidate, label: `${src.label} (copy)`, sort_order: (src.sort_order ?? 0) + 1 })
      .select("id")
      .single();
    if (ie) throw new Error(ie.message);

    const { data: opts } = await sb
      .from("product_custom_field_options")
      .select("label, value, sort_order")
      .eq("field_id", data.id);
    if (opts && opts.length) {
      const rows = opts.map((o: any) => ({ ...o, field_id: inserted.id }));
      const { error: oe } = await sb.from("product_custom_field_options").insert(rows);
      if (oe) throw new Error(oe.message);
    }
    return { ok: true, id: inserted.id };
  });

export const reorderCustomFieldsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ items: z.array(z.object({ id: z.string().uuid(), sort_order: z.number().int() })) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sb = context.supabase as any;
    for (const it of data.items) {
      const { error } = await sb
        .from("product_custom_fields")
        .update({ sort_order: it.sort_order })
        .eq("id", it.id);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

/* ---- Options ---- */

const optionsSchema = z.object({
  field_id: z.string().uuid(),
  options: z.array(z.object({
    label: z.string().trim().min(1).max(200),
    value: z.string().trim().min(1).max(200),
  })).max(200),
});

export const setCustomFieldOptionsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => optionsSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sb = context.supabase as any;
    const { error: delErr } = await sb
      .from("product_custom_field_options")
      .delete()
      .eq("field_id", data.field_id);
    if (delErr) throw new Error(delErr.message);
    if (data.options.length) {
      const rows = data.options.map((o, i) => ({
        field_id: data.field_id,
        label: o.label,
        value: o.value,
        sort_order: i,
      }));
      const { error } = await sb.from("product_custom_field_options").insert(rows);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });
