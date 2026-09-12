# bKash Checkout (URL) — Payment (Sale) flow: Corrected Implementation Plan

## Correction applied

The flow is the regular **Checkout (URL based) / Payment (Sale)** product: Create Payment (mode `0011`) -> hosted `bkashURL` -> callback -> Execute Payment -> mark paid. No customer Agreement ID and no Tokenized Checkout v2 (agreement) APIs will be implemented. bKash hosts both products on the same `tokenized.*` host and the same grant-token auth, which is why the names overlap; only the `mode` and endpoints differ.

## Verified against official docs (developer.bka.sh, version 1.2.0-beta)

- Base URLs: sandbox `https://tokenized.sandbox.bka.sh/v1.2.0-beta`, live `https://tokenized.pay.bka.sh/v1.2.0-beta` (bKash confirms your live base URL at onboarding; both are configurable via optional `BKASH_SANDBOX_BASE_URL` / `BKASH_LIVE_BASE_URL` secrets, defaulting to the above).
- Grant Token: `POST {base}/tokenized/checkout/token/grant`; headers `Content-Type: application/json`, `Accept`, `username`, `password`; body `{ app_key, app_secret }`; response `id_token`, `expires_in` (3600 s), `refresh_token`, `token_type`, `statusCode`.
- Create Payment (Checkout URL, sale): `POST {base}/tokenized/checkout/create`; headers `Authorization: <id_token>`, `X-App-Key`; body `{ mode: "0011", payerReference, callbackURL, amount, currency: "BDT", intent: "sale", merchantInvoiceNumber }` (amount as string; `payerReference` / `merchantInvoiceNumber` max 255 chars, no `<`, `>`, `&`). Response: `paymentID`, `bkashURL`, `callbackURL`, `successCallbackURL`, `failureCallbackURL`, `cancelledCallbackURL`, `statusCode` (`"0000"` = success). `paymentID` expires after 24 h and can be executed once.
- Callback: bKash redirects the customer's browser to `callbackURL?paymentID=<id>&status=success|failure|cancel`. It is a navigation only, not a confirmation; the server MUST call Execute Payment.
- Execute Payment: `POST {base}/tokenized/checkout/execute`; same auth headers; JSON body `{ paymentID }`. Success: `transactionStatus: "Completed"`, `trxID`, `amount`, `currency`, `merchantInvoiceNumber`, `statusCode: "0000"`; errors return `errorCode` / `errorMessage`.
- Query Payment (fallback when Execute times out or returns no definitive result): `POST {base}/tokenized/checkout/payment/status`; body `{ paymentID }`; returns `transactionStatus`, `trxID`, `amount`, `merchantInvoiceNumber`.
- Currency: bKash accepts **BDT only**.

## Currency handling (verified in this codebase)

- The store is single-currency: `settings.payment.currency` (default `"BDT"`, symbol `৳`) drives every displayed price; there is no exchange-rate or conversion logic anywhere in the app.
- `place_order` writes `orders.currency = 'USD'` as a hardcoded label, so `orders.total` is already the store-currency amount (BDT) mislabeled as USD. This is a data-label quirk, not a conversion.
- Plan: the bKash branch reads `settings.currency` from the saved payment config. If it is `BDT`, `order.total` is sent to bKash as-is with `currency: "BDT"` (no conversion). If the store currency is anything other than BDT, the request is refused with a clear error ("bKash only supports BDT; store currency is X") and a failed `payment_intents` row is recorded. Nothing is silently converted. The `orders.currency = 'USD'` label is left unchanged (schema/RPC out of scope) and reported here so you can decide separately whether to fix it.

## Files to change

### 1. NEW `src/lib/payments/bkash.server.ts` (server-only)
- `readCreds(mode)`: `BKASH_APP_KEY`, `BKASH_APP_SECRET`, `BKASH_USERNAME`, `BKASH_PASSWORD` from `process.env` inside functions (names already expected by `src/lib/payments/admin.functions.ts` line 49 and `.env.example`); optional `BKASH_LIVE_*` / `BKASH_SANDBOX_*` overrides, mirroring `sslcommerz.server.ts`.
- `isBkashConfigured(mode)`.
- `getBkashToken(mode)`: grant-token with in-memory cache per mode (expiry minus 5 min safety, concurrent calls deduplicated, retry once with a fresh grant on 401/invalid-token).
- `createBkashPayment(...)`: mode `0011`, intent `sale`, `merchantInvoiceNumber = orderNumber`, `payerReference = customer phone (digits) or orderNumber`, `callbackURL = {baseUrl}/api/public/payments/bkash/callback?order={orderNumber}`. Returns `{ ok, paymentID, bkashURL, raw }` or `{ ok:false, reason, raw }`.
- `executeBkashPayment(paymentID, mode)`, `queryBkashPayment(paymentID, mode)`: normalized `{ ok, transactionStatus, trxID, amount, merchantInvoiceNumber, raw, reason }`.
- All errors caught and returned as `{ ok:false, reason }`; `statusCode !== "0000"` / `errorCode` mapped to readable reasons; `logPaymentEvent` with `request_body: { masked: true, mode }` so secrets never reach logs.

### 2. EDIT `src/lib/payments/init.functions.ts`
- Add a `bkash` branch right after the SSLCommerz block, mirroring it: check `settings.bkash_enabled` and `settings.bkash_mode`; check `isBkashConfigured(mode)`; apply the BDT rule above; call `createBkashPayment`; insert `payment_intents` (`gateway: "bkash"`, `gateway_session_id: paymentID`, `redirect_url: bkashURL`, status `redirected` or `failed`); return `{ ok: true, gateway: "bkash", redirectUrl: bkashURL }`.
- No other lines change.

### 3. NEW `src/routes/api/public/payments.bkash.callback.ts`
- `GET` handler for `?order=...&paymentID=...&status=...`.
- Loads the order (`get_order_basic_by_number`) and latest bKash intent (`get_latest_payment_intent`) to get the mode and verify `paymentID` matches the stored `gateway_session_id`.
- `status=success`: `claimWebhookEvent("bkash", paymentID, orderId)` for idempotency, then `executeBkashPayment`; if the network fails or the result is indeterminate, `queryBkashPayment`. When `transactionStatus === "Completed"`, `merchantInvoiceNumber === orderNumber` and amount matches `order.total`, call the existing `processPaymentCallback({ status: "paid", gateway: "bkash", transactionId: trxID })`; otherwise `status: "failed"`.
- `status=failure|cancel`: log only; no order mutation.
- Redirects: paid -> `/thank-you?order=...`; otherwise `/pay/{orderNumber}`.
- Every step logged via `logPaymentEvent` (`callback`, `execute`, `query`).

### 4. Secrets (secure store only)
- After approval I open the secure secret form for `BKASH_APP_KEY`, `BKASH_APP_SECRET`, `BKASH_USERNAME`, `BKASH_PASSWORD` (values never pass through chat or code). Enable bKash and pick Sandbox/Live in Admin -> Settings -> Payments (`bkash_enabled`, `bkash_mode` already exist).

## Not changed
`src/routes/checkout.tsx`, `src/routes/pay.$orderNumber.tsx` (bKash already in `BUILTIN_AUTO`), SSLCommerz / custom / manual gateways, `payments.server.ts`, database schema, RLS, `payment_intents` structure, order and fulfillment flow, `orders.currency` label.

## Verification after implementation
- Typecheck passes; `bkash.server.ts` absent from the browser bundle.
- Sandbox end-to-end: place order -> bKash -> redirected to `bkashURL` -> complete with sandbox test wallet -> callback executes -> order paid -> license delivery and thank-you page work; failure/cancel return to the pay page without marking paid.
- Payment logs show masked credentials only.
