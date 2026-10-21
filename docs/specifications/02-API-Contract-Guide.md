# Auraflare — API contract guide

Status: proposed v1 baseline. `openapi.yaml` is the machine-readable interface; this guide defines transactional semantics and examples that schemas cannot enforce. Implementation must satisfy both. Endpoint changes update contract, examples and generated client in the same PR.

## Transport and conventions

- JSON REST under `/api/v1`, except session auth `/auth/*`, CSRF `/sanctum/csrf-cookie`, webhook `/webhooks/razorpay`. All paths in OpenAPI are root-relative, behind one HTTPS origin.
- IDs: opaque ULIDs, treated as strings. Human-readable order numbers are display-only. Currency `INR`; money fields use integer paise and `_minor` suffix. UTC ISO-8601 timestamps ending Z; business timezone Asia/Kolkata.
- Successful resources: `{ "data": ... }`; lists add `meta: {page,per_page,total}` and `links: {next,prev}`. Default per_page 20, maximum 100; stable ID tie-breaker on sort. Public product sorting supports featured, price_asc, price_desc, newest.
- Error: `{ "error": { "code", "message", "fields": {} }, "request_id" }`. `fields` maps field paths to string arrays. Never echo secrets, SQL, bank evidence or internal traces. 401 unauthenticated, 403 forbidden, 404 absent/inaccessible resource, 409 business/version conflict, 419 CSRF/session expiry, 422 field errors, 429 throttled with Retry-After, 503 transient integration outage. Insufficient stock is 409, not a silent quantity change.
- Unsafe session requests require CSRF. Cookie security described in architecture. Guest cart and order grants are scoped HttpOnly cookies; possession of an ID alone is insufficient. OpenAPI cookie names are proposed and must match actual Laravel session configuration in M0.
- `Idempotency-Key` required on order submission, direct-order creation, shipping quote issue, payment initiation, manual-evidence submission, approval/rejection, cancellations, inventory adjustment, refunds, shipment creation and content publication. Key 16–128 chars; scope by principal/guest grant, route and target. Same key/body returns the persisted original result; same key/different body → 409 IDEMPOTENCY_CONFLICT. Concurrent in-flight duplicate → 409 REQUEST_IN_PROGRESS with retry guidance. Retain keys ≥7 days; permanent business uniqueness prevents duplicate financial/stock effects after expiry.
- Stateful admin commands include `expected_version`. Compare under lock, then increment resource version. 409 VERSION_CONFLICT includes refreshed version in fields where safe. For payment initiation/evidence use immutable `quote_id` and `quote_version`; stale quote → 409 QUOTE_SUPERSEDED. Entity PATCH requests also require expected_version; explicit commands replace arbitrary status patches.
- Public list endpoints never accept unbounded arbitrary column/sort input. Enforce allowlists and pagination server-side. Dates are validated and bounded for reports/exports.

## Resource meanings

`Order.total_minor` and shipping amount are nullable before a shipping quote; zero is a real zero charge, never “pending.” Payment attempt has its own provider and status independent of order. Admin Order includes address/contact and internal records; public/guest Order excludes staff notes, raw provider payloads and private proofs. `allowed_actions` is advisory UI data; server policies always re-evaluate.

Cart belongs to the current guest browser or authenticated customer. Registration/login merges the guest cart through a deterministic upsert: aggregate variants and cap quantity at allowed request maximum; present conflicts and recalculate prices without creating stock holds. This is session middleware/action behaviour, not a separate public merge-by-ID endpoint. A persistent local cart may hold only non-sensitive variant IDs/quantities, and must be reconciled with API state.

## Example: request → quote → pay

```http
POST /api/v1/order-requests
Idempotency-Key: 65b2986b-2699-43a5-a51a-d08683534470
Content-Type: application/json
X-XSRF-TOKEN: <csrf-cookie-value>
```

```json
{
  "cart_id": "01K7XAPV8D94Q3JGXJNAFQ1AJC",
  "expected_cart_version": 4,
  "contact": {"name":"Example Customer","email":"customer@example.test","phone":"+919000000000"},
  "address": {"line1":"Example address","line2":"","city":"Kannur","state_code":"KL","postcode":"670001","country_code":"IN"},
  "customer_note": "Please contact before delivery.",
  "accept_terms": true
}
```

```json
{
  "data": {
    "id":"01K7XB0X9PHZ2NE0GDS4B4YDKH", "number":"AF-2026-000001",
    "status":"awaiting_shipping_quote", "payment_status":"unpaid", "fulfillment_status":"unfulfilled",
    "currency":"INR", "subtotal_minor":120000,"tax_minor":0,"shipping_minor":null,"total_minor":null,
    "version":1,"current_quote":null,"allowed_actions":["view","cancel"],
    "reservation_expires_at":"2026-10-20T15:56:29Z", "created_at":"2026-10-19T15:56:29Z",
    "items":[{"variant_id":"01K7XAPV8D94Q3JGXJNAFQ1AJD","title":"Example candle","sku":"EXAMPLE-01","quantity":2,"unit_price_minor":60000,"line_total_minor":120000}]
  }
}
```

Amounts, dates, addresses and IDs here are synthetic examples, not Auraflare business facts or tax decisions. Hold duration follows configured policy. The API also establishes an order-scoped guest session; it does not return a permanent reusable bearer secret in the response.

Owner quote command:

```http
POST /api/v1/admin/orders/01K7XB0X9PHZ2NE0GDS4B4YDKH/shipping-quotes
Idempotency-Key: quote-example-0001
```

```json
{"expected_version":1,"shipping_minor":8000,"expires_at":"2026-10-20T16:15:00Z","note":"Delivery charge confirmed"}
```

Server returns Order with current_quote, shipping_minor, tax_minor and total_minor. A shipping quote is an immutable version; issuing another does not edit the prior record. Tax values are computed from configured policy, never accepted from browser.

```http
POST /api/v1/orders/01K7XB0X9PHZ2NE0GDS4B4YDKH/payment-attempts
Idempotency-Key: payment-example-0001
```

```json
{"quote_id":"01K7XBC5SGBKNMVPVQWMYHAQPH","quote_version":1,"accept_quote":true}
```

```json
{"data":{"id":"01K7XBDPPY1PBM3MN3W1M6ZCG2","method":"razorpay","status":"created","amount_minor":128000,"currency":"INR","provider_order_id":"order_example","public_key_id":"rzp_test_example"}}
```

If provider order creation is ambiguous, return the same attempt with pending/unknown state (202) and poll the order. Do not return a fake provider order or blindly create another on refresh. Payment verification accepts only provider identifiers and signature; amount is read from the persisted attempt. 200 means the current verified attempt state, which may still be pending, not unconditional payment success.

Manual alternative:

```http
POST /api/v1/orders/{orderId}/manual-payment-evidence
Idempotency-Key: manual-example-0001
```

```json
{"quote_id":"01K7XBC5SGBKNMVPVQWMYHAQPH","quote_version":1,"accept_quote":true,"reference":"EXAMPLE-TRANSFER-REFERENCE","media_id":null}
```

This creates a manual attempt and evidence record. It returns 201, payment status under_review, and the updated deadline. Owner approval targets that evidence record and supplies expected order version plus an independently checked bank reference, received amount and received timestamp. Mismatch/duplicate reference blocks approval. Rejection records reason and releases the evidence review state; it does not silently erase history or automatically extend an expired quote.

## Endpoint groups and authorization

The OpenAPI document enumerates all launch endpoints and has per-operation capability metadata. Categories:

| Surface | Capabilities / behaviours |
|---|---|
| Auth | CSRF, register, login/logout, current user/profile/avatar/password, recovery, email verification, invitation acceptance |
| Public catalogue | Published product/variant/collection data only; stock available indicator, public content, delivery eligibility |
| Cart | Session-scoped create/read/items mutations; recalculate on each change; version conflicts |
| Checkout/orders | Submit request, secure guest access exchange, own order read/cancel, account claim, quote payment/evidence, own history and address book |
| Admin catalogue | Owner create/edit/archive products and variants; public price edit restricted; collection membership and media attachment |
| Inventory | Owner/staff balances, adjustments and movement history; no absolute quantity overwrite |
| Operations | Orders, direct orders, quotes, payment verification, full refunds, packing/dispatch/delivery, enquiries, private evidence access |
| Content/access | Owner draft/preview/publish content, delivery rule management, staff invites/role/deactivation, profile, audit and exports |
| Gateway | Signed raw-body webhook; session/CSRF exempt only at this endpoint |

Public media intake accepts only purpose `manual_payment_proof` under an accessible order; customer/avatar and admin catalogue images require the proper session and purpose policy. Attachments must be ready and owned/authorized before use. Do not accept a client-chosen storage path or public URL as trusted upload ownership.

## Webhook contract and failure semantics

`POST /webhooks/razorpay`: read exact raw bytes; verify X-Razorpay-Signature with webhook secret, independently of the API key secret. Deduplicate by unique(provider,event_id) using x-razorpay-event-id. Acknowledge 200 only after durable inbox persistence; duplicate valid event also returns 200. Invalid signature → 400; DB unavailable → 503 so provider retries. Unknown valid event types are stored and ignored with audit metadata. Process asynchronously and replay from inbox after queue outage.

Events can arrive out of order. Never regress paid to failed because an older event arrived. Validate provider payment/order/amount/currency against the internal attempt. Both browser verify and webhook call the same idempotent settlement action. Reconciliation runs every five minutes for pending/unknown attempts and periodically checks recent exceptions/refunds; exact lookback/limits are configurable and respect provider rate limits.

## Error examples

```json
{"error":{"code":"INSUFFICIENT_STOCK","message":"One or more items are no longer available.","fields":{"items.0.quantity":["Only 1 unit is currently available."]}},"request_id":"request-example-001"}
```

Other defined business codes: PRICE_CHANGED, VERSION_CONFLICT, QUOTE_REQUIRED, QUOTE_EXPIRED, QUOTE_SUPERSEDED, DELIVERY_UNAVAILABLE, PAYMENT_IN_PROGRESS, PAYMENT_EXCEPTION, INVALID_TRANSITION, LAST_OWNER, MEDIA_NOT_READY, IDEMPOTENCY_CONFLICT, REQUEST_IN_PROGRESS. Keep code values stable; presentation copy may evolve.

## Compatibility and validation

OpenAPI 3.0.3 intentionally uses widely supported nullable schemas for client generation. Validate spec structure in CI with a pinned OpenAPI validator and generated TypeScript compilation; validate response examples and run Laravel contract tests, not only YAML parsing. No generic unconstrained success objects should replace the named domain schemas. The provider webhook payload remains an extensible object because its schema belongs to Razorpay; the local envelope/security is defined here.

Version v1 is not a deployed API. Freeze endpoint shapes at the end of M0 after resolving marked defaults, then evolve additively; breaking changes require coordinated frontend/backend release or a versioned endpoint. Actual tax values, manual bank instructions and provider secrets are configuration, never committed fixtures.
