// Gateway registry server functions.
// Public list returns enabled gateways for checkout. Admin functions handle
// CRUD on payment_gateways and approval workflow on manual_payment_submissions.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { csrfGuard } from "@/lib/security/csrf.server";
import type { createClient } from "@supabase/supabase-js";
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
  const { createServerSupabaseClient } = await import("@/integrations/supabase/server-client");
  const supabase = createServerSupabaseClient();
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
      sort_order: data.sort_order ?? 0,
      config: (data.config ?? {}) as never,
    };
    if (data.id) {
      const { data: row, error } = await context.supabase
        .from("payment_gateways").update(payload).eq("id", data.id).select("*").single();
      if (error) throw new Error(error.message);
      return { gateway: row };
    }
    // New gateway: append to bottom of its type by using max(sort_order)+10
    if (data.sort_order == null) {
      const { data: maxRow } = await context.supabase
        .from("payment_gateways")
        .select("sort_order")
        .eq("type", data.type)
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle();
      payload.sort_order = ((maxRow?.sort_order ?? 0) as number) + 10;
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

export const reorderGatewaysFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { items: { id: string; sort_order: number }[] }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    // Update each row's sort_order. Small set (typically <20), sequential is fine.
    for (const it of data.items) {
      const { error } = await context.supabase
        .from("payment_gateways")
        .update({ sort_order: it.sort_order })
        .eq("id", it.id);
      if (error) throw new Error(error.message);
    }
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
    const { getRequest } = await import("@tanstack/react-start/server");

    // Extract the caller's bearer token BEFORE constructing the Supabase
    // client so it can be passed into `global.headers.Authorization` at
    // creation time. Mutating `sb.rest.headers.Authorization` afterwards
    // does not propagate to PostgREST, which is why logged-in callers
    // previously executed the RPC with auth.uid() = NULL and hit the
    // `Forbidden` guard inside submit_manual_payment_proof().
    let accessToken: string | null = null;
    try {
      const authHeader = getRequest()?.headers.get("authorization") ?? null;
      if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.slice("Bearer ".length).trim();
        if (token && token.split(".").length === 3) accessToken = token;
      }
    } catch {
      // No request context — proceed as anonymous (guest).
    }

    const sb = createServerSupabaseClient(accessToken);

    const { data: result, error } = await sb.rpc("submit_manual_payment_proof", {
      _order_number: data.order_number,
      _gateway_slug: data.gateway_slug,
      _transaction_id: data.transaction_id,
      _sender_name: data.sender_name,
      _sender_account: data.sender_account,
      _screenshot_url: data.screenshot_url,
      _note: data.note,
      _email: data.email,
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

// Read-only: latest submission for a specific order (authenticated user only).
// Guests fall back to order.status alone. This does NOT modify payment logic.
export const getMySubmissionForOrderFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { orderNumber: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("manual_payment_submissions")
      .select("id, status, admin_note, gateway_slug, transaction_id, screenshot_url, reviewed_at, created_at, orders!inner(order_number)")
      .eq("orders.order_number", data.orderNumber)
      .order("created_at", { ascending: false })
      .limit(1);
    if (error) throw new Error(error.message);
    return { submission: rows?.[0] ?? null };
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
      // Call admin_mark_order_paid via a JWT-forwarded server client so
      // auth.uid() / has_role('admin') resolve inside the SECURITY DEFINER
      // function. On Lovable Cloud / Cloudflare Workers the managed
      // SUPABASE_SERVICE_ROLE_KEY is not readable at runtime, so
      // supabaseAdmin falls back to the publishable key which lacks
      // EXECUTE on mark_order_paid ("permission denied for function
      // mark_order_paid"). admin_mark_order_paid IS granted to the
      // authenticated role and enforces the admin check internally.
      const { createServerSupabaseClient } = await import("@/integrations/supabase/server-client");
      const { getRequest } = await import("@tanstack/react-start/server");
      let accessToken: string | null = null;
      try {
        const authHeader = getRequest()?.headers.get("authorization") ?? null;
        if (authHeader?.startsWith("Bearer ")) {
          const token = authHeader.slice("Bearer ".length).trim();
          if (token && token.split(".").length === 3) accessToken = token;
        }
      } catch { /* no request context */ }
      if (!accessToken) throw new Error("Missing admin auth token");
      const sb = createServerSupabaseClient(accessToken);
      const txn = sub.transaction_id || `manual-${sub.id.slice(0, 8)}`;
      const { data: paid, error: pErr } = await sb.rpc("admin_mark_order_paid", {
        _order_id: sub.order_id,
        _transaction_id: txn,
        _gateway_response: { gateway: sub.gateway_slug, manual_submission_id: sub.id, admin_note: data.admin_note ?? null },
      });
      if (pErr) throw new Error(pErr.message);
      const paidResult = paid as { ok?: boolean; reason?: string } | null;
      if (!paidResult?.ok) {
        throw new Error(`Failed to mark order paid: ${paidResult?.reason ?? "unknown"}`);
      }
      try {
        const { sendPostPaymentEmails } = await import("@/lib/emails/triggers.server");
        await sendPostPaymentEmails(sub.order_id);
      } catch (e) {
        console.error("[emails] post-payment dispatch failed", e);
      }
    }
    return { ok: true };
  });
