// Gateway registry server functions.
// Public list returns enabled gateways for checkout. Admin functions handle
// CRUD on payment_gateways and approval workflow on manual_payment_submissions.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { csrfGuard } from "@/lib/security/csrf.server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type GatewayType = "builtin" | "custom_auto" | "manual";
export type GatewayMode = "sandbox" | "live";
export type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };

export type GatewayRow = {
  id: string;
  slug: string;
  name: string;
  type: GatewayType;
  logo_url: string | null;
  description: string | null;
  is_enabled: boolean;
  mode: GatewayMode;
  sort_order: number;
  config: { [k: string]: JsonValue };
};


// ---------------- Public (checkout) ----------------

export const listEnabledGatewaysFn = createServerFn({ method: "GET" }).handler(async () => {
  // Uses SECURITY DEFINER RPC `list_public_payment_gateways` which strips
  // credentials from `config` (only safe fields exposed for manual methods).
  const supabase = createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
  const { data, error } = await supabase.rpc("list_public_payment_gateways");
  if (error) throw new Error(error.message);
  return { gateways: (data ?? []) as unknown as GatewayRow[] };
});

// ---------------- Admin: CRUD ----------------

async function assertAdmin(ctx: { supabase: ReturnType<typeof createClient<Database>>; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

export const listAllGatewaysFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as never);
    const { data, error } = await context.supabase
      .from("payment_gateways")
      .select("*")
      .order("type", { ascending: true })
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return { gateways: (data ?? []) as GatewayRow[] };
  });

export const upsertGatewayFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    id?: string;
    slug: string;
    name: string;
    type: GatewayType;
    logo_url?: string | null;
    description?: string | null;
    is_enabled?: boolean;
    mode?: GatewayMode;
    sort_order?: number;
    config?: { [k: string]: JsonValue };
  }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const payload = {
      slug: data.slug.trim().toLowerCase(),
      name: data.name.trim(),
      type: data.type,
      logo_url: data.logo_url ?? null,
      description: data.description ?? null,
      is_enabled: data.is_enabled ?? false,
      mode: data.mode ?? "sandbox",
      sort_order: data.sort_order ?? 100,
      config: (data.config ?? {}) as never,
    };
    if (data.id) {
      const { data: row, error } = await context.supabase
        .from("payment_gateways").update(payload).eq("id", data.id).select("*").single();
      if (error) throw new Error(error.message);
      return { gateway: row };
    }
    const { data: row, error } = await context.supabase
      .from("payment_gateways").insert(payload).select("*").single();
    if (error) throw new Error(error.message);
    return { gateway: row };
  });

export const deleteGatewayFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { error } = await context.supabase.from("payment_gateways").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const toggleGatewayFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; is_enabled: boolean }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { error } = await context.supabase
      .from("payment_gateways").update({ is_enabled: data.is_enabled }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------------- Manual submissions ----------------

export const submitManualPaymentFn = createServerFn({ method: "POST" })
  .middleware([csrfGuard])
  .inputValidator((d: {
    order_number: string;
    gateway_slug: string;
    transaction_id?: string;
    sender_name?: string;
    sender_account?: string;
    screenshot_url?: string;
    note?: string;
    email?: string;
  }) => d)
  .handler(async ({ data }) => {
    const { createServerSupabaseClient } = await import("@/integrations/supabase/server-client");
    const sb = createServerSupabaseClient();
    const { data: result, error } = await sb.rpc("submit_manual_payment_proof", {
      _order_number: data.order_number,
      _gateway_slug: data.gateway_slug,
      _transaction_id: data.transaction_id ?? null,
      _sender_name: data.sender_name ?? null,
      _sender_account: data.sender_account ?? null,
      _screenshot_url: data.screenshot_url ?? null,
      _note: data.note ?? null,
      _email: data.email ?? null,
    });
    if (error) throw new Error(error.message);
    if (result && typeof result === "object" && "ok" in result && !(result as { ok?: boolean }).ok) {
      throw new Error(String((result as { reason?: string }).reason ?? "Could not submit payment proof"));
    }
    return { ok: true };
  });

export const getMySubmissionsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("manual_payment_submissions")
      .select("id, gateway_slug, status, transaction_id, amount, currency, screenshot_url, admin_note, reviewed_at, created_at, order_id, orders!inner(order_number, total, currency, status)")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listSubmissionsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { status?: "pending" | "approved" | "rejected" | "all" }) => d ?? {})
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    let q = context.supabase
      .from("manual_payment_submissions")
      .select("*, orders!inner(order_number, total, currency, status)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (data?.status && data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { submissions: rows ?? [] };
  });

export const reviewSubmissionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; action: "approve" | "reject"; admin_note?: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { data: sub, error: sErr } = await context.supabase
      .from("manual_payment_submissions").select("*").eq("id", data.id).single();
    if (sErr) throw new Error(sErr.message);

    const newStatus = data.action === "approve" ? "approved" : "rejected";
    const { error: uErr } = await context.supabase
      .from("manual_payment_submissions")
      .update({
        status: newStatus,
        admin_note: data.admin_note ?? null,
        reviewed_by: (context as { userId: string }).userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (uErr) throw new Error(uErr.message);

    if (data.action === "approve") {
      const txn = sub.transaction_id || `manual-${sub.id.slice(0, 8)}`;
      const { data: paid, error: pErr } = await context.supabase.rpc("admin_mark_order_paid", {
        _order_id: sub.order_id,
        _transaction_id: txn,
        _gateway_response: { gateway: sub.gateway_slug, manual_submission_id: sub.id, admin_note: data.admin_note ?? null },
      });
      if (pErr) throw new Error(pErr.message);
      try {
        const { sendPostPaymentEmails } = await import("@/lib/emails/triggers.server");
        await sendPostPaymentEmails(sub.order_id);
      } catch (e) {
        console.error("[emails] post-payment dispatch failed", e);
      }
    }
    return { ok: true };
  });
