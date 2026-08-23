import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type CheckoutField = {
  id: string;
  product_id: string;
  product_slug: string;
  name: string;
  label: string;
  field_type: string;
  placeholder: string | null;
  help_text: string | null;
  default_value: string | null;
  is_required: boolean;
  min_length: number | null;
  max_length: number | null;
  regex_pattern: string | null;
  sort_order: number;
  options: { label: string; value: string }[];
};

/** Public: list enabled+visible custom fields for the given product slugs. */
export const listCheckoutFieldsFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ slugs: z.array(z.string().min(1)).min(1).max(50) }).parse(d),
  )
  .handler(async ({ data }): Promise<CheckoutField[]> => {
    const { createServerSupabaseClient } = await import("@/integrations/supabase/server-client");
    const sb = createServerSupabaseClient() as any;

    const { data: products, error: pe } = await sb
      .from("products")
      .select("id, slug")
      .in("slug", data.slugs);
    if (pe) throw new Error(pe.message);
    const list = (products ?? []) as { id: string; slug: string }[];
    if (list.length === 0) return [];
    const idToSlug = new Map(list.map((p) => [p.id, p.slug]));

    const { data: fields, error: fe } = await sb
      .from("product_custom_fields")
      .select("*")
      .in("product_id", list.map((p) => p.id))
      .eq("is_enabled", true)
      .eq("is_visible", true)
      .order("sort_order", { ascending: true });
    if (fe) throw new Error(fe.message);
    const rows = (fields ?? []) as any[];
    if (rows.length === 0) return [];

    const { data: opts } = await sb
      .from("product_custom_field_options")
      .select("field_id, label, value, sort_order")
      .in("field_id", rows.map((r) => r.id))
      .order("sort_order", { ascending: true });
    const optionsByField = new Map<string, { label: string; value: string }[]>();
    for (const o of (opts ?? []) as any[]) {
      const arr = optionsByField.get(o.field_id) ?? [];
      arr.push({ label: o.label, value: o.value });
      optionsByField.set(o.field_id, arr);
    }

    return rows.map((f) => ({
      id: f.id,
      product_id: f.product_id,
      product_slug: idToSlug.get(f.product_id) ?? "",
      name: f.name,
      label: f.label,
      field_type: f.field_type,
      placeholder: f.placeholder,
      help_text: f.help_text,
      default_value: f.default_value,
      is_required: !!f.is_required,
      min_length: f.min_length,
      max_length: f.max_length,
      regex_pattern: f.regex_pattern,
      sort_order: f.sort_order ?? 0,
      options: optionsByField.get(f.id) ?? [],
    }));
  });

const valueEntry = z.object({
  field_id: z.string().uuid(),
  value: z.string().max(5000).nullable().optional(),
});

const saveSchema = z.object({
  orderId: z.string().uuid(),
  email: z.string().email().optional(),
  values: z.array(valueEntry).max(200),
});

/** Guest: save values (RPC verifies email matches order). */
export const saveOrderCustomFieldsGuestFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => saveSchema.parse(d))
  .handler(async ({ data }) => {
    const { createServerSupabaseClient } = await import("@/integrations/supabase/server-client");
    const sb = createServerSupabaseClient() as any;
    const { data: r, error } = await sb.rpc("save_order_custom_field_values", {
      _order_id: data.orderId,
      _values: data.values,
      _email: data.email ?? null,
    });
    if (error) throw new Error(error.message);
    return r;
  });

/** Authenticated/Admin: save values. */
export const saveOrderCustomFieldsAuthFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => saveSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: r, error } = await (context.supabase as any).rpc(
      "save_order_custom_field_values",
      { _order_id: data.orderId, _values: data.values, _email: data.email ?? null },
    );
    if (error) throw new Error(error.message);
    return r;
  });

const readSchema = z.object({
  orderId: z.string().uuid(),
  email: z.string().email().optional(),
});

export type OrderCustomFieldValue = {
  id: string;
  order_id: string;
  product_id: string | null;
  product_slug: string | null;
  field_id: string | null;
  field_name: string;
  field_label: string;
  field_type: string;
  value: string | null;
};

async function runGetOrderValues(sb: any, orderId: string, email?: string) {
  const { data, error } = await sb.rpc("get_order_custom_field_values", {
    _order_id: orderId,
    _email: email ?? null,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as OrderCustomFieldValue[];
}

export const getOrderCustomFieldsGuestFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => readSchema.parse(d))
  .handler(async ({ data }) => {
    const { createServerSupabaseClient } = await import("@/integrations/supabase/server-client");
    return runGetOrderValues(createServerSupabaseClient(), data.orderId, data.email);
  });

export const getOrderCustomFieldsAuthFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => readSchema.parse(d))
  .handler(async ({ data, context }) => runGetOrderValues(context.supabase, data.orderId, data.email));

/** Admin: update a single stored value. */
export const adminUpdateOrderCustomFieldValueFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), value: z.string().max(5000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: r, error } = await (context.supabase as any).rpc(
      "admin_update_order_custom_field_value",
      { _id: data.id, _value: data.value },
    );
    if (error) throw new Error(error.message);
    return r;
  });
