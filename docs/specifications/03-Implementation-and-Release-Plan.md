# Auraflare — implementation and release plan

## Delivery approach

Implement vertical slices: each phase ships a working API, integrated screens and meaningful checks. Frontend work can begin with contract-backed mocks after M0, but a mocked success is never treated as an integrated feature. One monorepo, one PR review process, separate CI jobs selected by changed paths. Contract changes trigger both jobs. Feature branches and small reviewed PRs are proposed; creating a repository, pushing commits, sending real messages and production deployment are not performed by this planning task.

### M0 — foundation, contract and configuration decisions

Deliver repository skeleton from architecture; AGENTS.md and contribution instructions; pinned PHP/Node/package/container versions; Docker Compose API/web/MySQL/Redis/worker/scheduler/mail-capture services; `.env.example`; API and web health checks; JSON error formatting; generated API client; contract lint; seeded synthetic development data; public design tokens and reference manifest. Use mock email and Razorpay test mode only.

Resolve exact delivery allowlist, tax/invoice rules, manual-payment destination/instructions, brand assets/catalogue, stock locations (one assumed), hold windows, email provider, business support address, hosting/domain, return/refund policy and owner contact for alerts. These do not block scaffolding but must block real payment activation when relevant. Record each in `docs/decisions` with confirmed/proposed status; do not silently invent business inputs.

Acceptance: fresh clone runs using documented make commands; `/up` and frontend health pass; contract validates; TypeScript client compiles; no secrets/default owner passwords; staging routing proves cookies/CSRF work; tax/delivery policy fail closed while unconfigured. Freeze v1 schemas before implementing finance endpoints.

### M1 — identity, staff and profile

Backend: sessions, customer registration/verification/recovery, staff memberships, policies, invitation issuance/acceptance, first-owner CLI, profile/avatar/password changes, guest session primitives and current permissions. Frontend: real blank login, registration, recovery, team invitation/edit/deactivate screens and profile. No role selector at login, no assumed signed-in account and no demo authentication.

Acceptance: customer cannot reach admin endpoints; fulfillment cannot invite owners/edit pricing; expired/reused invitations fail; final-owner concurrent changes cannot remove all owners; inactive staff loses access; current password required for change; other sessions revoked; avatar ownership/type/size enforced; duplicate normalized email handled. Recovery endpoints do not enumerate emails. Preview outgoing messages locally; activate external delivery only as part of an authorized implementation/release.

### M2 — catalogue, media, inventory and delivery

Backend: owner CRUD/archive products/variants/collections, validated upload pipeline, inventory adjustments/ledger/threshold alerts, allowlist rules and public catalogue projections. Frontend: transfer approved design into responsive server-rendered catalogue/product/collection pages and admin catalogue/inventory forms. Preserve supplied candle photographs and wine/ivory/champagne theme; Cormorant Garamond/DM Sans from admin reference, confirm final storefront fonts against latest design. Keep reduced-motion, skip/Escape intro, keyboard dialogs, sticky navbar and rounded image frames. Animate transform/opacity, avoid layout work per frame; intro must never block access or LCP unnecessarily.

Acceptance: public sees only active products and ready media; all active variants have unique SKU/options; staff cannot change prices; concurrent adjustments cannot make on_hand < reserved; inventory history is immutable; invalid postcode is unavailable; server rejects malicious uploads; out-of-stock quick-add is disabled and server-enforced. Catalogue remains browsable without decorative animations.

### M3 — cart, order requests and shipping quotes

Backend: guest/account cart, deterministic login merge, serviceability, server repricing, transactional holds, idempotent submission, versioned owner quotes, expiry sweeper, direct-order creation using the same stock/pricing actions, secure guest order access and verified account claiming. Frontend: request checkout form, subtotal/shipping-pending copy, order page with deadline, staff order list/details, owner quote form and customer quote acceptance.

Acceptance: two customers racing for the last unit produce one reservation; duplicate submit returns one order; displayed price mismatch requires review; quote missing/expired blocks payment; no guest can fetch another order by ID; quoted shipping and tax are visibly included before acceptance. Expiry/cancel releases exactly once, including concurrent cases. Order requests appear in admin and survive reload. Direct WhatsApp/Instagram orders obey the same no-overselling rules; staff cannot supply arbitrary price overrides.

### M4 — Razorpay and manual payment

Backend: provider adapter, durable attempts, ambiguous-create recovery, browser signature verification, webhook inbox/deduplication/worker, captured payment validation, reconciliation, manual evidence upload/review, exceptional late/duplicate payment handling, full refund workflow and outbox notifications. Frontend: pay after accepted quote, provider pending/failure/retry states, manual instructions/proof form, owner review queue and refund controls.

Acceptance: no browser-only paid transition; signature/amount/currency/provider-order mismatch rejected; duplicate/out-of-order events and browser/webhook races produce one settlement/stock consumption; provider timeout and process crash recover without blind duplicate charge creation; queue outage is replayable; manual screenshot alone stays unpaid; staff cannot approve evidence; a reference cannot verify multiple orders; late capture is surfaced as exception; duplicate payment/refund requires recovery with audit, not silent success. Simulate timeout after provider success and after DB persistence, not only clean fake responses.

### M5 — fulfillment, enquiries, content and reporting

Backend: pack/dispatch/deliver, manual tracking, enquiry submission/notes/status/assignment, draft/publish content revisions, public-cache invalidation, dashboard definitions, owner CSV export, audit search. Frontend: working order actions, enquiry inbox, responsive content editor/preview and real metric/error/empty states. Staff sees operational overview only; owner sees finance/team/publishing.

Acceptance: unpaid order cannot ship; shipment duplicate safe; no partial shipments in v1; internal enquiry notes never public; drafts never publicly cached; published home content survives restart; all money-changing operations auditable; revenue excludes unpaid and reflects successful refunds; time boundaries use IST; export access is scoped and spreadsheet-formula-safe. CSV download URLs expire.

### M6 — staging qualification and launch

Run end-to-end guest and account paths, direct orders, manual verification, Razorpay test-mode success/failure/timeout/late-event/refund paths, fulfilment and enquiry/publish flows. Perform browser QA at 320/360/390/430/768/1024/1440 px, long copy and keyboard/reduced-motion checks. Content hero preview must grow with copy; tables scroll within their cards; no page-wide overflow. Measure catalogue LCP and animation smoothness on a throttled mobile profile and set budgets from that baseline. Inspect real API-backed screens against reference assets.

Operational acceptance: backup restore rehearsal; migrations tested on a staging copy; workers/scheduler supervised and singleton schedule locking; webhook publicly reachable via HTTPS; readiness detects required dependencies; alert routing works; no debug mode; private media inaccessible anonymously; robots excludes staging/admin/order pages; payment secrets isolated; deployment/rollback rehearsed. Load test the stock race on MySQL rather than SQLite. Inspect logs for sensitive data.

Launch gate: owner confirms real catalogue/stock/serviceability/tax/policies and bank instructions; Razorpay live credentials/webhook/capture configuration verified in the account; transactional domain/email configured; production environment and bootstrap owner ready. Deploy code/schema first behind checkout-off configuration, verify health and public catalogue, then enable checkout and live payment deliberately. Run an explicitly authorized low-value live transaction and refund as a release exercise; this plan does not authorize a real charge. Do not “test” by charging customers without consent.

## Definition of done for every slice

- Laravel actions/policies/requests/resources and migrations match the contract and documented state rules.
- Frontend uses generated types and real integration; loading/empty/validation/403/expired-session/conflict/pending states are truthful.
- Relevant unit, API, integration and browser checks pass; no implementation-mirroring tests for trivial presentation edits.
- Security/stock/financial changes include scenario tests for permissions, concurrency, retries and recovery.
- Contract, migration/setup notes and runbooks are updated in the same PR. Report any verification limitations explicitly.

## Essential test matrix

| Risk | Verification |
|---|---|
| Broken admin access | Capability matrix against every protected route; own-resource authorization |
| Overselling | Parallel MySQL requests for one SKU; duplicate lines; expiry/settlement/cancel races |
| Double settlement | Duplicate webhook IDs, distinct events for same payment, callback/webhook race, repeated manual approval |
| Payment confusion | Unknown provider create result, old quote payment, wrong amount/currency/order, late capture, method switching |
| Refund errors | Duplicate refund command, lost provider response, failed then reconciled refund; no double restock |
| Leaked guest orders | Guessed IDs, expired/replayed access grant, different browser, unverified account claim |
| Broken uploads | Disguised MIME, oversized image/PDF, unowned attachment, expired private link |
| Team takeover | Last-owner concurrent mutation, invitation replay/wrong email, deactivation session revoke |
| Publishing/cache | Draft isolation, post-publish freshness, stale-cache TTL fallback |
| Browser reliability | Mobile long copy, keyboard/focus, reduced motion, refresh during pending payment |

## CI/CD

API job: Composer install from lock, Pint check, PHPStan/Larastan, Pest/PHPUnit with MySQL and Redis integration services, contract response assertions, migration smoke test and production image build. Web job: frozen pnpm install, lint, TypeScript, meaningful component tests, production build and Playwright critical-path suite against API. Contract job: OpenAPI structural validation, example validation, client generation with clean-diff check and compatibility review. Dependency/security scans use maintained tooling; pin versions in M0.

Release uses immutable commit-tagged images. Deploy backward-compatible expand migrations, API and frontend; restart long-running workers with the new code and verify queue/scheduler readiness. Avoid dropping/renaming required columns in the same release. Destructive cleanup uses a later release after compatibility window. Roll back images only while schema remains compatible; restore backup for true data corruption under an explicit recovery procedure, not automatic down migrations.

Runtime config: APP_KEY, DB/Redis connection, session cookie settings, APP_URL, storage buckets/access, Razorpay key ID/secret/webhook secret, mail provider settings, public base URL, business timezone, hold durations and checkout-enabled switch. Only public key ID and public URLs may reach browser config. No provider secret prefixed as a public frontend variable.

Monitoring: request ID across API/worker/outbox, error rate/latency, pending webhook age, reconciliation backlog, failed job count, oldest shipping-review request, oldest manual evidence, overdue holds, stock invariant failures, notification failures and refund exceptions. Route alerts to configured owner contacts; do not log proof contents, tokens or full PII. Proposed recovery objectives must be agreed against budget; backup frequency alone is not proof of recoverability.

## Scope intentionally deferred

Multi-warehouse, automatic courier rates/labels, international currency, made-to-order stock, COD, promotions/coupons, partial shipment/refund, exchanges/self-service returns, subscriptions, marketplace sellers, accounting integrations and granular custom role builder. Add only after an explicit requirement; do not accidentally expose these as working controls copied from a template.

## Effort and sequencing

Sequence: M0 → M1 → M2 → M3 → M4 → M5 → M6. Catalogue/admin frontend can proceed against frozen mocks during backend work; payment integration waits for actual order/quote semantics. Indicative range for an experienced full-time engineer: 8–12 engineer-weeks plus unresolved business/provider onboarding time; two engineers may overlap frontend/backend work but cannot halve the calendar automatically. This is a scope-based planning estimate, not a committed delivery date. Re-estimate after M0 and after the first end-to-end slice.
