// Server-only runtime adapter for "custom_auto" payment gateways.
// Drives any HTTP-based gateway purely from the JSON config saved in
// payment_gateways.config — no per-provider code required.
//
// Supported config shape (all fields optional unless noted):
// {
//   api_base_url: string,                       // required for live calls
//   create_endpoint: string,                    // required; e.g. "/v1/payments"
//   verify_endpoint?: string,                   // e.g. "/v1/payments/{transaction_id}"
//   test_endpoint?: string,                     // for health check; defaults to api_base_url
//   request_method?: "POST" | "GET" | "PUT",    // default POST
//   headers?: Record<string,string>,
//   auth_type?: "none" | "api_key" | "bearer" | "basic" | "custom_header",
//   auth?: {
//     token?: string;                           // bearer / api_key value
//     header_name?: string;                     // default "Authorization"
//     query_param?: string;                     // when auth_type=api_key in querystring
//     username?: string; password?: string;     // basic
//     value?: string;                           // custom_header value
//   },
//   create_body_template?: object,              // body with {placeholders}
//   redirect_path?: string,                     // dot-path in response to extract redirect url
//                                               // default tries: redirect_url, url, payment_url, data.redirect_url, data.url
//   transaction_path?: string,                  // dot-path to gateway txn id; default: id, transaction_id, data.id
//   success_url?: string, cancel_url?: string,  // returned to gateway; default derived from baseUrl
//   webhook: {
//     signature_header?: string,                // default "X-Signature"
//     secret?: string,                          // shared HMAC secret
//     verification?: "hmac_sha256" | "hmac_sha512" | "shared_secret" | "none",
//     status_path?: string,                     // default tries: status, data.status, payment_status
//     transaction_path?: string,                // default: transaction_id, txn_id, id, data.id
//     paid_values?: string[],                   // default ["paid","success","completed","successful"]
//     event_id_path?: string,                   // default tries: event_id, id, data.id, transaction_id
//   }
// }

import { createHmac, timingSafeEqual } from "crypto";
import { logPaymentEvent } from "./logger.server";

export type CustomAutoConfig = Record<string, unknown>;

type CreateSessionInput = {
  gatewaySlug: string;
  config: CustomAutoConfig;
  orderId: string;
  orderNumber: string;
  amount: number;
  currency: string;
  customerName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  productName: string;
  baseUrl: string;
};

export type CreateSessionResult =
  | { ok: true; redirectUrl: string; transactionId: string | null; raw: unknown }
  | { ok: false; reason: string; raw?: unknown };

// ---------- utils ----------

function getPath(obj: unknown, path: string): unknown {
  if (!path) return undefined;
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc == null || typeof acc !== "object") return undefined;
    return (acc as Record<string, unknown>)[key];
  }, obj);
}

function firstString(obj: unknown, candidates: string[]): string | null {
  for (const p of candidates) {
    const v = getPath(obj, p);
    if (typeof v === "string" && v.length > 0) return v;
    if (typeof v === "number") return String(v);
  }
  return null;
}

function interpolate(value: unknown, ctx: Record<string, string | number>): unknown {
  if (typeof value === "string") {
    return value.replace(/\{(\w+)\}/g, (_, k) => (k in ctx ? String(ctx[k]) : `{${k}}`));
  }
  if (Array.isArray(value)) return value.map((v) => interpolate(v, ctx));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = interpolate(v, ctx);
    return out;
  }
  return value;
}

function buildAuthHeaders(config: CustomAutoConfig): { headers: Record<string, string>; queryParam?: { name: string; value: string } } {
  const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json" };
  const extra = (config.headers as Record<string, string>) || {};
  for (const [k, v] of Object.entries(extra)) headers[k] = String(v);

  const authType = (config.auth_type as string) || "none";
  const auth = (config.auth as Record<string, string>) || {};
  switch (authType) {
    case "bearer": {
      if (auth.token) headers[auth.header_name || "Authorization"] = `Bearer ${auth.token}`;
      break;
    }
    case "api_key": {
      if (auth.query_param) return { headers, queryParam: { name: auth.query_param, value: auth.token || "" } };
      if (auth.token) headers[auth.header_name || "X-API-Key"] = auth.token;
      break;
    }
    case "basic": {
      const u = auth.username || "";
      const p = auth.password || "";
      headers["Authorization"] = `Basic ${Buffer.from(`${u}:${p}`).toString("base64")}`;
      break;
    }
    case "custom_header": {
      if (auth.header_name) headers[auth.header_name] = auth.value || auth.token || "";
      break;
    }
  }
  return { headers };
}

function joinUrl(base: string, path: string, query?: Record<string, string>): string {
  const url = new URL(path.startsWith("http") ? path : `${base.replace(/\/$/, "")}/${path.replace(/^\//, "")}`);
  if (query) for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  return url.toString();
}

// ---------- public adapter ----------

export async function createCustomAutoSession(input: CreateSessionInput): Promise<CreateSessionResult> {
  const cfg = input.config;
  const apiBase = String(cfg.api_base_url || "");
  const endpoint = String(cfg.create_endpoint || "");
  if (!apiBase || !endpoint) return { ok: false, reason: "missing_api_base_url_or_create_endpoint" };

  const method = (String(cfg.request_method || "POST")).toUpperCase();
  const successUrl = String(cfg.success_url || `${input.baseUrl}/pay/${input.orderNumber}?result=success`);
  const cancelUrl = String(cfg.cancel_url || `${input.baseUrl}/pay/${input.orderNumber}?result=cancel`);
  const webhookUrl = `${input.baseUrl}/api/public/payments/custom-webhook/${input.gatewaySlug}`;

  const ctx: Record<string, string | number> = {
    order_id: input.orderId,
    order_number: input.orderNumber,
    amount: input.amount,
    currency: input.currency,
    customer_name: input.customerName || "",
    customer_email: input.customerEmail || "",
    customer_phone: input.customerPhone || "",
    product_name: input.productName,
    success_url: successUrl,
    cancel_url: cancelUrl,
    webhook_url: webhookUrl,
  };

  const defaultBody = {
    order_number: input.orderNumber,
    amount: input.amount,
    currency: input.currency,
    customer: { name: input.customerName, email: input.customerEmail, phone: input.customerPhone },
    product_name: input.productName,
    success_url: successUrl,
    cancel_url: cancelUrl,
    webhook_url: webhookUrl,
    metadata: { order_id: input.orderId },
  };
  const body = interpolate(cfg.create_body_template ?? defaultBody, ctx);

  const { headers, queryParam } = buildAuthHeaders(cfg);
  const url = joinUrl(apiBase, endpoint, queryParam ? { [queryParam.name]: queryParam.value } : undefined);

  let resp: Response;
  let text = "";
  try {
    resp = await fetch(url, {
      method,
      headers,
      body: method === "GET" ? undefined : JSON.stringify(body),
    });
    text = await resp.text();
  } catch (e) {
    const reason = e instanceof Error ? e.message : "network_error";
    await logPaymentEvent({
      gateway: input.gatewaySlug, event_type: "error",
      order_id: input.orderId, order_number: input.orderNumber,
      error_message: reason, request_body: { url, method, body },
    });
    return { ok: false, reason };
  }

  let json: unknown = text;
  try { json = JSON.parse(text); } catch { /* keep as text */ }

  await logPaymentEvent({
    gateway: input.gatewaySlug, event_type: "init",
    order_id: input.orderId, order_number: input.orderNumber,
    status: resp.ok ? "ok" : "failed",
    request_body: { url, method, body }, response_body: json,
    error_message: resp.ok ? null : `HTTP ${resp.status}`,
  });

  if (!resp.ok) return { ok: false, reason: `gateway_http_${resp.status}`, raw: json };

  const redirectCandidates = (cfg.redirect_path ? [String(cfg.redirect_path)] : [])
    .concat(["redirect_url", "url", "payment_url", "checkout_url", "data.redirect_url", "data.url", "data.checkout_url", "data.GatewayPageURL"]);
  const txCandidates = (cfg.transaction_path ? [String(cfg.transaction_path)] : [])
    .concat(["transaction_id", "id", "session_id", "data.transaction_id", "data.id", "data.session_id"]);

  const redirectUrl = firstString(json, redirectCandidates);
  const transactionId = firstString(json, txCandidates);
  if (!redirectUrl) return { ok: false, reason: "redirect_url_not_found_in_response", raw: json };

  return { ok: true, redirectUrl, transactionId, raw: json };
}

export async function verifyCustomAutoPayment(args: {
  gatewaySlug: string; config: CustomAutoConfig; transactionId: string; orderNumber: string;
}): Promise<{ ok: boolean; status: "paid" | "failed" | "pending"; raw: unknown }> {
  const cfg = args.config;
  const apiBase = String(cfg.api_base_url || "");
  const endpoint = String(cfg.verify_endpoint || "");
  if (!apiBase || !endpoint) return { ok: false, status: "pending", raw: { reason: "no_verify_endpoint" } };

  const path = endpoint.replace("{transaction_id}", args.transactionId).replace("{order_number}", args.orderNumber);
  const { headers, queryParam } = buildAuthHeaders(cfg);
  const url = joinUrl(apiBase, path, queryParam ? { [queryParam.name]: queryParam.value } : undefined);

  try {
    const resp = await fetch(url, { method: "GET", headers });
    const text = await resp.text();
    let json: unknown = text; try { json = JSON.parse(text); } catch { /* keep */ }
    const status = extractStatus(json, cfg);
    await logPaymentEvent({
      gateway: args.gatewaySlug, event_type: "validate",
      order_number: args.orderNumber, transaction_id: args.transactionId,
      status, response_body: json, error_message: resp.ok ? null : `HTTP ${resp.status}`,
    });
    return { ok: resp.ok, status, raw: json };
  } catch (e) {
    return { ok: false, status: "failed", raw: { error: e instanceof Error ? e.message : "network_error" } };
  }
}

export function extractStatus(payload: unknown, cfg: CustomAutoConfig): "paid" | "failed" | "pending" {
  const wcfg = (cfg.webhook as Record<string, unknown>) || {};
  const paths = (wcfg.status_path ? [String(wcfg.status_path)] : [])
    .concat(["status", "payment_status", "data.status", "data.payment_status", "transaction_status"]);
  const raw = firstString(payload, paths)?.toLowerCase() || "";
  const paid = ((wcfg.paid_values as string[]) || ["paid", "success", "completed", "successful", "valid"]).map((s) => s.toLowerCase());
  if (paid.includes(raw)) return "paid";
  if (["failed", "cancelled", "canceled", "declined", "error"].includes(raw)) return "failed";
  return "pending";
}

export async function testCustomAutoConnection(args: { gatewaySlug: string; config: CustomAutoConfig }):
  Promise<{ ok: boolean; status?: number; latencyMs: number; message: string }> {
  const cfg = args.config;
  const apiBase = String(cfg.api_base_url || "");
  if (!apiBase) return { ok: false, latencyMs: 0, message: "api_base_url not set" };
  const endpoint = String(cfg.test_endpoint || cfg.verify_endpoint || cfg.create_endpoint || "");
  const url = joinUrl(apiBase, endpoint || "/");
  const { headers } = buildAuthHeaders(cfg);
  const start = Date.now();
  try {
    const resp = await fetch(url, { method: "GET", headers });
    const latencyMs = Date.now() - start;
    await logPaymentEvent({
      gateway: args.gatewaySlug, event_type: "test",
      status: resp.ok ? "ok" : "failed",
      request_body: { url }, response_body: { status: resp.status },
      error_message: resp.ok ? null : `HTTP ${resp.status}`,
    });
    return { ok: resp.status < 500, status: resp.status, latencyMs, message: resp.ok ? "Reachable" : `HTTP ${resp.status}` };
  } catch (e) {
    const latencyMs = Date.now() - start;
    const msg = e instanceof Error ? e.message : "network_error";
    await logPaymentEvent({ gateway: args.gatewaySlug, event_type: "error", error_message: msg, request_body: { url } });
    return { ok: false, latencyMs, message: msg };
  }
}

// ---------- webhook signature ----------

export function verifyWebhookSignature(rawBody: string, headerValue: string | null, cfg: CustomAutoConfig):
  { valid: boolean; reason?: string } {
  const wcfg = (cfg.webhook as Record<string, unknown>) || {};
  const mode = (wcfg.verification as string) || "hmac_sha256";
  const secret = (wcfg.secret as string) || "";
  if (mode === "none") return { valid: true };
  if (!secret) return { valid: false, reason: "no_secret_configured" };
  if (!headerValue) return { valid: false, reason: "missing_signature_header" };

  if (mode === "shared_secret") {
    const a = Buffer.from(headerValue);
    const b = Buffer.from(secret);
    if (a.length !== b.length) return { valid: false, reason: "length_mismatch" };
    try { return { valid: timingSafeEqual(a, b) }; } catch { return { valid: false, reason: "compare_failed" }; }
  }

  const algo = mode === "hmac_sha512" ? "sha512" : "sha256";
  const expected = createHmac(algo, secret).update(rawBody).digest("hex");
  // strip common prefixes like "sha256=" 
  const sig = headerValue.replace(/^sha(256|512)=/i, "");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return { valid: false, reason: "length_mismatch" };
  try { return { valid: timingSafeEqual(a, b) }; } catch { return { valid: false, reason: "compare_failed" }; }
}

export function extractWebhookEventId(payload: unknown, cfg: CustomAutoConfig, fallback: string): string {
  const wcfg = (cfg.webhook as Record<string, unknown>) || {};
  const paths = (wcfg.event_id_path ? [String(wcfg.event_id_path)] : [])
    .concat(["event_id", "id", "data.event_id", "data.id", "transaction_id", "data.transaction_id"]);
  return firstString(payload, paths) || fallback;
}

export function extractTransactionId(payload: unknown, cfg: CustomAutoConfig): string | null {
  const wcfg = (cfg.webhook as Record<string, unknown>) || {};
  const paths = (wcfg.transaction_path ? [String(wcfg.transaction_path)] : [])
    .concat(["transaction_id", "txn_id", "id", "data.transaction_id", "data.txn_id", "data.id"]);
  return firstString(payload, paths);
}

export function extractOrderNumber(payload: unknown): string | null {
  return firstString(payload, [
    "order_number", "orderNumber", "order_id",
    "data.order_number", "data.orderNumber", "data.order_id",
    "metadata.order_number", "metadata.orderNumber", "metadata.order_id",
  ]);
}
