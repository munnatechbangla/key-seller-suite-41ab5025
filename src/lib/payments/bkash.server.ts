import { logPaymentEvent } from "./logger.server";

export type BkashMode = "sandbox" | "live";

type BkashCredentials = {
  appKey: string;
  appSecret: string;
  username: string;
  password: string;
};

type ApiResponse = Record<string, unknown>;

type OperationResult =
  | { ok: true; data: ApiResponse }
  | { ok: false; reason: string; uncertain: boolean; data?: ApiResponse };

type CachedToken = { value: string; expiresAt: number };

const tokenCache = new Map<BkashMode, CachedToken>();
const tokenRequests = new Map<BkashMode, Promise<{ ok: true; token: string } | { ok: false; reason: string }>>();
const TOKEN_REFRESH_MARGIN_MS = 60_000;

function credentials(mode: BkashMode): BkashCredentials {
  const prefix = mode === "live" ? "BKASH_LIVE_" : "BKASH_SANDBOX_";
  return {
    appKey: process.env[`${prefix}APP_KEY`] || process.env.BKASH_APP_KEY || "",
    appSecret: process.env[`${prefix}APP_SECRET`] || process.env.BKASH_APP_SECRET || "",
    username: process.env[`${prefix}USERNAME`] || process.env.BKASH_USERNAME || "",
    password: process.env[`${prefix}PASSWORD`] || process.env.BKASH_PASSWORD || "",
  };
}

function baseUrl(mode: BkashMode): string {
  return mode === "live"
    ? "https://tokenized.pay.bka.sh/v1.2.0-beta"
    : "https://tokenized.sandbox.bka.sh/v1.2.0-beta";
}

export function isBkashConfigured(mode: BkashMode): boolean {
  const c = credentials(mode);
  return Boolean(c.appKey && c.appSecret && c.username && c.password);
}

function safeResponse(data: ApiResponse): ApiResponse {
  const keys = [
    "statusCode",
    "paymentID",
    "trxID",
    "transactionStatus",
    "amount",
    "currency",
    "merchantInvoiceNumber",
    "createTime",
    "updateTime",
    "errorCode",
  ];
  return Object.fromEntries(keys.filter((key) => data[key] != null).map((key) => [key, data[key]]));
}

async function postJson(
  url: string,
  headers: Record<string, string>,
  body: Record<string, unknown>,
): Promise<OperationResult> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    return { ok: false, reason: "bkash_network_error", uncertain: true };
  }

  let data: ApiResponse;
  try {
    const parsed: unknown = await response.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ok: false, reason: "bkash_invalid_response", uncertain: true };
    }
    data = parsed as ApiResponse;
  } catch {
    return { ok: false, reason: "bkash_invalid_response", uncertain: true };
  }

  if (!response.ok) {
    return {
      ok: false,
      reason: `bkash_http_${response.status}`,
      uncertain: response.status >= 500,
      data,
    };
  }
  if (data.statusCode !== "0000") {
    return { ok: false, reason: "bkash_provider_rejected", uncertain: false, data };
  }
  return { ok: true, data };
}

async function grantToken(mode: BkashMode): Promise<{ ok: true; token: string } | { ok: false; reason: string }> {
  const c = credentials(mode);
  if (!c.appKey || !c.appSecret || !c.username || !c.password) {
    return { ok: false, reason: "bkash_credentials_not_configured" };
  }
  const result = await postJson(
    `${baseUrl(mode)}/tokenized/checkout/token/grant`,
    { username: c.username, password: c.password },
    { app_key: c.appKey, app_secret: c.appSecret },
  );
  if (!result.ok) {
    await logPaymentEvent({
      gateway: "bkash",
      event_type: "token_grant",
      status: "failed",
      error_message: result.reason,
    });
    return { ok: false, reason: result.reason };
  }

  const token = result.data.id_token;
  if (typeof token !== "string" || !token) {
    return { ok: false, reason: "bkash_token_missing" };
  }
  const expiresIn = Number(result.data.expires_in);
  const lifetimeMs = Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn * 1000 : 3_600_000;
  tokenCache.set(mode, { value: token, expiresAt: Date.now() + lifetimeMs });
  await logPaymentEvent({ gateway: "bkash", event_type: "token_grant", status: "ok" });
  return { ok: true, token };
}

export async function getBkashToken(
  mode: BkashMode,
): Promise<{ ok: true; token: string } | { ok: false; reason: string }> {
  const cached = tokenCache.get(mode);
  if (cached && cached.expiresAt - TOKEN_REFRESH_MARGIN_MS > Date.now()) {
    return { ok: true, token: cached.value };
  }

  const pending = tokenRequests.get(mode);
  if (pending) return pending;

  const request = grantToken(mode);
  tokenRequests.set(mode, request);
  try {
    return await request;
  } finally {
    if (tokenRequests.get(mode) === request) tokenRequests.delete(mode);
  }
}

export async function createBkashPayment(input: {
  orderNumber: string;
  amount: number;
  payerReference: string;
  callbackURL: string;
  mode: BkashMode;
  persistPaymentID: (paymentID: string, response: ApiResponse) => Promise<void>;
}): Promise<
  | { ok: true; paymentID: string; bkashURL: string; response: ApiResponse }
  | { ok: false; reason: string; uncertain: boolean; paymentID?: string; response?: ApiResponse }
> {
  if (!isBkashConfigured(input.mode)) {
    return { ok: false, reason: "bkash_credentials_not_configured", uncertain: false };
  }
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { ok: false, reason: "bkash_invalid_order_amount", uncertain: false };
  }
  const token = await getBkashToken(input.mode);
  if (!token.ok) return { ok: false, reason: token.reason, uncertain: true };

  const c = credentials(input.mode);
  const result = await postJson(
    `${baseUrl(input.mode)}/tokenized/checkout/create`,
    { Authorization: token.token, "X-App-Key": c.appKey },
    {
      mode: "0011",
      payerReference: input.payerReference.slice(0, 50) || input.orderNumber,
      callbackURL: input.callbackURL,
      amount: input.amount.toFixed(2),
      currency: "BDT",
      intent: "sale",
      merchantInvoiceNumber: input.orderNumber,
    },
  );

  if (!result.ok) {
    const returnedPaymentID = result.data?.paymentID;
    const paymentID = typeof returnedPaymentID === "string" && returnedPaymentID ? returnedPaymentID : undefined;
    const response = result.data ? safeResponse(result.data) : undefined;
    if (paymentID) {
      try {
        await input.persistPaymentID(paymentID, response ?? {});
      } catch {
        return { ok: false, reason: "bkash_payment_id_persist_failed", uncertain: true, paymentID, response };
      }
    }
    await logPaymentEvent({
      gateway: "bkash",
      event_type: "init",
      order_number: input.orderNumber,
      transaction_id: paymentID ?? null,
      amount: input.amount,
      currency: "BDT",
      status: "failed",
      request_body: { mode: input.mode, currency: "BDT", amount: input.amount.toFixed(2) },
      error_message: result.reason,
      response_body: response,
    });
    return { ...result, paymentID, response, uncertain: result.uncertain || Boolean(paymentID) };
  }

  const returnedPaymentID = result.data.paymentID;
  const paymentID = typeof returnedPaymentID === "string" && returnedPaymentID ? returnedPaymentID : undefined;
  const response = safeResponse(result.data);
  if (paymentID) {
    try {
      await input.persistPaymentID(paymentID, response);
    } catch {
      return { ok: false, reason: "bkash_payment_id_persist_failed", uncertain: true, paymentID, response };
    }
  }

  const bkashURL = result.data.bkashURL;
  if (!paymentID || typeof bkashURL !== "string" || !bkashURL) {
    return { ok: false, reason: "bkash_create_response_incomplete", uncertain: true, paymentID, response };
  }
  try {
    const checkoutUrl = new URL(bkashURL);
    if (checkoutUrl.protocol !== "https:" || !checkoutUrl.hostname.endsWith(".bka.sh")) {
      return { ok: false, reason: "bkash_create_response_invalid_url", uncertain: true, paymentID, response };
    }
  } catch {
    return { ok: false, reason: "bkash_create_response_invalid_url", uncertain: true, paymentID, response };
  }

  await logPaymentEvent({
    gateway: "bkash",
    event_type: "init",
    order_number: input.orderNumber,
    transaction_id: paymentID,
    amount: input.amount,
    currency: "BDT",
    status: "redirected",
    request_body: { mode: input.mode, currency: "BDT", amount: input.amount.toFixed(2) },
    response_body: response,
  });
  return { ok: true, paymentID, bkashURL, response };
}

async function paymentOperation(paymentID: string, mode: BkashMode, operation: "execute" | "status"): Promise<OperationResult> {
  const token = await getBkashToken(mode);
  if (!token.ok) return { ok: false, reason: token.reason, uncertain: true };
  const c = credentials(mode);
  const endpoint = operation === "execute" ? "execute" : "payment/status";
  const result = await postJson(
    `${baseUrl(mode)}/tokenized/checkout/${endpoint}`,
    { Authorization: token.token, "X-App-Key": c.appKey },
    { paymentID },
  );
  await logPaymentEvent({
    gateway: "bkash",
    event_type: operation === "execute" ? "execute" : "validate",
    transaction_id: paymentID,
    status: result.ok ? String(result.data.transactionStatus ?? "unknown") : "failed",
    response_body: result.ok ? safeResponse(result.data) : { reason: result.reason },
    error_message: result.ok ? null : result.reason,
  });
  return result;
}

export async function executeBkashPayment(paymentID: string, mode: BkashMode): Promise<OperationResult> {
  return paymentOperation(paymentID, mode, "execute");
}

export async function queryBkashPayment(paymentID: string, mode: BkashMode): Promise<OperationResult> {
  return paymentOperation(paymentID, mode, "status");
}