# Acceptance evidence

Measured in this managed cloud workspace on 2026-10-20. Source is on feat/auraflare-production-rebuild. The historical application remains recoverable from backup-before-fresh-start-2026-10-19; legacy private data is separately protected outside the checkout. No legacy data was imported.

| Check | Recorded result |
|---|---|
| Portable setup | scripts/setup.sh completed, including a repeat run: frozen pnpm/Composer install, migrations, empty-catalogue seeder, supervised API/worker/scheduler, MySQL/Redis/mail capture and configuration check |
| Hosted CI | [GitHub Actions run 39387436895](https://github.com/alfinjiji/lumora-web/actions/runs/39387436895) passed on a clean Ubuntu runner for application commit `3279a0453c144534edbc76f823b227eb3b81aec7`: portable setup, backend/contract/TypeScript, lint/format/static analysis, production Next.js build, nine browser journeys and generated-client consistency. Automatic setup-node package-manager caching is disabled because the pinned pnpm is installed by the project helper during setup. |
| Backend | **53 tests, 425 assertions passed** against guarded MySQL auraflare_test; no skipped tests |
| Real races | Five fork/barrier scenarios with separate MySQL connections: last-unit reservation, inventory adjustment, final owner, callback/webhook settlement and expiry versus settlement |
| Additional business/security cases | Unknown create reconciliation without second create; authorization/failure/capture ordering; duplicate/excess/late captures; receipt-based refund; independent manual verification; session/email hold caps and intake rate limit; recovery/guest token replay, verified claim and direct-order ownership; account boundaries; media/content/enquiry/resource tests |
| Contract | Full Redocly validation passed without warnings; **104 routes**, **49 request schemas**, generated client/metadata consistency and freeze hash checked; **18** supplied examples/runtime snapshots validated |
| Backend style/static checks | Pint passed; Larastan level 3 passed with no errors; Composer manifest/lock validation passed with its expected style warning about deliberately pinning Laravel to an exact patch |
| Frontend | TypeScript and ESLint passed; Prettier check passed; optimized Next.js build passed |
| Browser | **9 browser journeys passed**, including guest/manual-payment/fulfillment, owner/staff permissions, customer address and account ordering, real-photo product/variant/stock with a >3MiB multipart upload, seven-width long content, intro/keyboard/reduced motion/mobile navigation, staff direct orders and public enquiry assignment/private notes/CMS draft/publication. |
| Compiled deployment shape | Non-root PHP-FPM and standalone Next.js images built; local Nginx edge served storefront/admin/API and CSRF; DB/Redis/storage readiness passed. Browser checked images/empty catalogue/login at seven widths through that edge. Local HTTP rehearsal used an isolated schema and explicit local overrides. |
| Upload runtime | PHP HTTP limits aligned with the 10MiB application cap (10M file, 12M body, 256M memory); decoded/re-encoded uploads remain bounded. Larger real multipart request is included in the product browser check. |
| Outbound TLS | Laravel HTTP/cURL reached Razorpay’s protected API with certificate verification enabled and returned the expected unauthenticated 401. No key, charge or payment-data retrieval was used. Runtime CA override is supplied for the managed proxy. |
| Background services | Scheduler list/run succeeded; Redis scheduler and worker heartbeat keys were present; readiness returned ready. Queue/inbox/outbox sweeps and proof retry/pruning are scheduled. |
| Storage | S3 adapter wrote/read/deleted an object against a private local Moto emulator. This does not verify a real cloud bucket or IAM. |
| Backup/restore | Consistent snapshot plus local media backup/checksums; restored a nonempty synthetic database into auraflare_restore_rehearsal: two orders and four movements. Media was extracted separately. Actual application data was not replaced. |
| Migrations | All six migrations applied on new schemas; re-running forward migrations on the actual development DB reported nothing to migrate |
| Actual default database | Zero products, zero owner/staff memberships, checkout disabled; synthetic users/catalogue/orders remain in separate test schemas |
| Performance | Two final cold/throttled mobile samples: LCP 3.984s and 3.944s, CLS 0.000291, 691,155 transfer bytes. See PERFORMANCE.md for baseline, budgets and limits. |

Hosted CI and the constituent local commands passed. Public hosting, real DNS/HTTPS ingress, live/test Razorpay account, external mail provider, real S3 IAM, deployed ClamAV, physical-phone performance and offsite disaster recovery have not been independently qualified. These remain explicit launch gates rather than claims established by fake/emulator checks.
