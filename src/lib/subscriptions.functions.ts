import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

const accountStatus = z.enum(["available", "assigned", "expired", "disabled", "maintenance"]);
const profileStatus = z.enum(["available", "assigned", "blocked"]);

// ---------- Dashboard ----------
export const getSubscriptionDashboardFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase.rpc("admin_subscription_dashboard" as any);
    if (error) throw new Error(error.message);
    return data ?? {};
  });

// ---------- Accounts ----------
export const listSubscriptionAccountsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        search: z.string().optional(),
        status: accountStatus.optional(),
        product_id: z.string().uuid().nullable().optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sb = context.supabase as any;
    let q = sb
      .from("subscription_accounts")
      .select(
        "id, product_id, provider, account_email, recovery_email, two_factor_enabled, notes, status, maximum_profiles, used_profiles, renewal_date, expiry_date, auto_renew, last_checked_at, created_at, updated_at",
      )
      .order("created_at", { ascending: false });
    if (data.status) q = q.eq("status", data.status);
    if (data.product_id) q = q.eq("product_id", data.product_id);
    if (data.search) q = q.ilike("account_email", `%${data.search}%`);
    const { data: rows, error } = await q.limit(500);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const accountSchema = z.object({
  id: z.string().uuid().optional(),
  product_id: z.string().uuid().nullable().optional(),
  provider: z.string().nullable().optional(),
  account_email: z.string().email(),
  account_password: z.string().optional(),
  recovery_email: z.string().email().nullable().optional().or(z.literal("")),
  recovery_password: z.string().optional(),
  two_factor_enabled: z.boolean().optional(),
  notes: z.string().nullable().optional(),
  status: accountStatus.optional(),
  maximum_profiles: z.number().int().min(1).optional(),
  renewal_date: z.string().nullable().optional(),
  expiry_date: z.string().nullable().optional(),
  auto_renew: z.boolean().optional(),
});

export const upsertSubscriptionAccountFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => accountSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sb = context.supabase as any;
    const { encryptSecret } = await import("@/lib/subscriptions/crypto.server");
    const payload: Record<string, unknown> = {
      product_id: data.product_id ?? null,
      provider: data.provider ?? null,
      account_email: data.account_email,
      recovery_email: data.recovery_email || null,
      two_factor_enabled: data.two_factor_enabled ?? false,
      notes: data.notes ?? undefined,
      status: data.status ?? "available",
      maximum_profiles: data.maximum_profiles ?? 1,
      renewal_date: data.renewal_date || null,
      expiry_date: data.expiry_date || null,
      auto_renew: data.auto_renew ?? false,
    };
    if (data.account_password) {
      payload.account_password_encrypted = await encryptSecret(data.account_password);
    }
    if (data.recovery_password) {
      payload.recovery_password_encrypted = await encryptSecret(data.recovery_password);
    }
    if (data.id) {
      const { error } = await sb.from("subscription_accounts").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      await sb.from("subscription_logs").insert({
        subscription_account_id: data.id,
        action: "account_updated",
        actor_id: context.userId,
      });
      return { ok: true, id: data.id };
    }
    const { data: row, error } = await sb
      .from("subscription_accounts")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await sb.from("subscription_logs").insert({
      subscription_account_id: row.id,
      action: "account_created",
      actor_id: context.userId,
    });
    return { ok: true, id: row.id };
  });

export const deleteSubscriptionAccountFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sb = context.supabase as any;
    const { error } = await sb.from("subscription_accounts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const revealSubscriptionCredentialsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sb = context.supabase as any;
    const { data: row, error } = await sb
      .from("subscription_accounts")
      .select("account_password_encrypted, recovery_password_encrypted")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    const { decryptSecret } = await import("@/lib/subscriptions/crypto.server");
    await sb.from("subscription_logs").insert({
      subscription_account_id: data.id,
      action: "credentials_revealed",
      actor_id: context.userId,
    });
    return {
      account_password: await decryptSecret(row.account_password_encrypted),
      recovery_password: await decryptSecret(row.recovery_password_encrypted),
    };
  });

export const bulkImportSubscriptionAccountsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        product_id: z.string().uuid().nullable().optional(),
        provider: z.string().nullable().optional(),
        rows: z
          .array(
            z.object({
              account_email: z.string().email(),
              account_password: z.string().optional(),
              recovery_email: z.string().optional(),
              recovery_password: z.string().optional(),
            }),
          )
          .min(1)
          .max(1000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sb = context.supabase as any;
    const { encryptSecret } = await import("@/lib/subscriptions/crypto.server");
    const payload = await Promise.all(
      data.rows.map(async (r) => ({
        product_id: data.product_id ?? null,
        provider: data.provider ?? null,
        account_email: r.account_email,
        account_password_encrypted: await encryptSecret(r.account_password),
        recovery_email: r.recovery_email || null,
        recovery_password_encrypted: await encryptSecret(r.recovery_password),
        status: "available",
      })),
    );
    const { error } = await sb.from("subscription_accounts").insert(payload);
    if (error) throw new Error(error.message);
    return { ok: true, inserted: payload.length };
  });

// ---------- Profiles ----------
export const listSubscriptionProfilesFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ account_id: z.string().uuid().optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sb = context.supabase as any;
    let q = sb.from("subscription_profiles").select("*").order("slot_number", { ascending: true });
    if (data.account_id) q = q.eq("subscription_account_id", data.account_id);
    const { data: rows, error } = await q.limit(1000);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const profileSchema = z.object({
  id: z.string().uuid().optional(),
  subscription_account_id: z.string().uuid(),
  profile_name: z.string().min(1),
  pin_code: z.string().nullable().optional(),
  avatar: z.string().nullable().optional(),
  slot_number: z.number().int().nullable().optional(),
  status: profileStatus.optional(),
});

export const upsertSubscriptionProfileFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => profileSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sb = context.supabase as any;
    const payload = { ...data };
    if (data.id) {
      const { error } = await sb.from("subscription_profiles").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    }
    const { data: row, error } = await sb
      .from("subscription_profiles")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: row.id };
  });

export const deleteSubscriptionProfileFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sb = context.supabase as any;
    const { error } = await sb.from("subscription_profiles").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Assignments ----------
export const listSubscriptionAssignmentsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const sb = context.supabase as any;
    const { data, error } = await sb
      .from("subscription_assignments")
      .select("*")
      .order("assigned_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// ---------- Logs ----------
export const listSubscriptionLogsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const sb = context.supabase as any;
    const { data, error } = await sb
      .from("subscription_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// ============================================================
// Customer-facing delivery (authed + guest via email)
// ============================================================
const deliveryInput = z.object({
  orderId: z.string().uuid().optional(),
  orderNumber: z.string().optional(),
  email: z.string().email().optional(),
});

async function resolveOrderId(sb: any, orderId?: string, orderNumber?: string) {
  if (orderId) return orderId;
  if (!orderNumber) return null;
  const { data, error } = await sb
    .from("orders")
    .select("id")
    .eq("order_number", orderNumber)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.id ?? null;
}

async function fetchAndDecryptDelivery(sb: any, orderId: string, email?: string) {
  const { data, error } = await sb.rpc("get_order_subscription_delivery", {
    _order_id: orderId,
    _email: email ?? null,
  } as any);
  if (error) throw new Error(error.message);
  const rows = (data as any[]) ?? [];
  if (rows.length === 0) return [];
  const { decryptSecret } = await import("@/lib/subscriptions/crypto.server");
  return Promise.all(
    rows.map(async (r) => {
      const password = await decryptSecret(r.account_password_encrypted);
      const { account_password_encrypted: _drop, ...rest } = r;
      return { ...rest, account_password: password };
    }),
  );
}

export const getOrderSubscriptionDeliveryAuthedFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => deliveryInput.parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const id = await resolveOrderId(sb, data.orderId, data.orderNumber);
    if (!id) return [];
    return fetchAndDecryptDelivery(sb, id, data.email);
  });

export const getOrderSubscriptionDeliveryGuestFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => deliveryInput.parse(d))
  .handler(async ({ data }) => {
    if (!data.email) return [];
    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const id = await resolveOrderId(sb, data.orderId, data.orderNumber);
    if (!id) return [];
    return fetchAndDecryptDelivery(sb, id, data.email);
  });

// ============================================================
// Admin assignment actions
// ============================================================
export const releaseSubscriptionAssignmentFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), reason: z.string().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: r, error } = await context.supabase.rpc(
      "admin_release_subscription_assignment" as any,
      { _assignment_id: data.id, _reason: data.reason ?? undefined },
    );
    if (error) throw new Error(error.message);
    return r;
  });

export const replaceSubscriptionAssignmentFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: r, error } = await context.supabase.rpc(
      "admin_replace_subscription_assignment" as any,
      { _assignment_id: data.id },
    );
    if (error) throw new Error(error.message);
    return r;
  });

export const markSubscriptionExpiredFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: r, error } = await context.supabase.rpc("admin_mark_subscription_expired" as any, {
      _assignment_id: data.id,
    });
    if (error) throw new Error(error.message);
    return r;
  });

export const addSubscriptionNoteFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), note: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: r, error } = await context.supabase.rpc("admin_add_subscription_note" as any, {
      _assignment_id: data.id,
      _note: data.note,
    });
    if (error) throw new Error(error.message);
    return r;
  });


// ============================================================
// Phase 3.3 — Lifecycle management
// ============================================================
export const extendSubscriptionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      days: z.number().int().min(1).max(3650),
      notes: z.string().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: r, error } = await (context.supabase.rpc as any)("admin_extend_subscription" as any, {
      _assignment_id: data.id,
      _days: data.days,
      _notes: data.notes ?? undefined,
    });
    if (error) throw new Error(error.message);
    return r as any;
  });

export const renewSubscriptionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      days: z.number().int().min(1).max(3650).default(30),
      notes: z.string().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: r, error } = await (context.supabase.rpc as any)("admin_renew_subscription" as any, {
      _assignment_id: data.id,
      _days: data.days,
      _notes: data.notes ?? undefined,
    });
    if (error) throw new Error(error.message);
    return r as any;
  });

export const suspendSubscriptionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), reason: z.string().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: r, error } = await (context.supabase.rpc as any)("admin_suspend_subscription" as any, {
      _assignment_id: data.id,
      _reason: data.reason ?? undefined,
    });
    if (error) throw new Error(error.message);
    return r as any;
  });

export const resumeSubscriptionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: r, error } = await (context.supabase.rpc as any)("admin_resume_subscription" as any, {
      _assignment_id: data.id,
    });
    if (error) throw new Error(error.message);
    return r;
  });

export const cancelSubscriptionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), reason: z.string().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: r, error } = await context.supabase.rpc("admin_cancel_subscription" as any, {
      _assignment_id: data.id,
      _reason: data.reason ?? undefined,
    });
    if (error) throw new Error(error.message);
    return r;
  });

export const evaluateSubscriptionStatusFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid().optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.id) {
      const { error } = await (context.supabase.rpc as any)("evaluate_subscription_status" as any, {
        _assignment_id: data.id,
      });
      if (error) throw new Error(error.message);
      return { ok: true };
    }
    const { data: r, error } = await (context.supabase.rpc as any)("evaluate_all_subscriptions" as any);
    if (error) throw new Error(error.message);
    return { ok: true, evaluated: r };
  });

export const getSubscriptionRenewalHistoryFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: r, error } = await (context.supabase.rpc as any)(
      "get_subscription_renewal_history" as any,
      { _assignment_id: data.id } as any
    );
    if (error) throw new Error(error.message);
    return r ?? [];
  });

export const getMySubscriptionsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await (context.supabase.rpc as any)("get_customer_subscriptions" as any, {
      _email: undefined,
    } as any);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getGuestSubscriptionsFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ email: z.string().email() }).parse(d))
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data: rows, error } = await sb.rpc("get_customer_subscriptions", {
      _email: data.email,
    });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
