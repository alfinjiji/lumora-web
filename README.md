# Auraflare

Auraflare’s storefront and studio administration, rebuilt from the supplied design and implementation kit. Next.js serves the approved design; Laravel owns identity, catalogue, INR pricing, inventory, order requests, shipping quotes, payments, fulfillment, enquiries, content and reporting.

## Development

Prerequisites: Node 24, Docker with Compose/BuildKit, Make and Python 3. PHP 8.5, MySQL 8.4 and Redis run in containers. Development containers map the current Linux UID/GID for bind-mount writes; release containers use a fixed non-root user. Versions and dependency locks are committed.

```sh
make setup
make dev
```

Setup creates a private local `.env` only when absent, generates a new application key/database passwords, installs frozen dependencies, applies forward migrations and starts the API, queue worker, scheduler, database, Redis and local mail capture. Re-running setup preserves existing settings and data. It never creates known passwords, sample products or an owner account. `make stop` stops services without deleting volumes.

The Next.js server listens on port 5173 and forwards `/api/v1`, `/auth`, `/sanctum`, `/webhooks` and `/media` to Laravel. This is a local development workflow; cloud onboarding does not publish a public preview. The old GitHub Pages application is a separate historical deployment and cannot host this backend.

Create the first owner with `make owner`, then process its outbox with `scripts/docker.sh compose exec api php artisan auraflare:work-outbox`. Open the resulting HTML file **privately** under `apps/api/storage/app/private/mail-previews`. The one-time link establishes the owner’s own password; there are no default login credentials. Existing owners invite subsequent staff from Team & access.

The production catalogue starts empty. Kerala is initially enabled at state level, with owner-managed city and PIN-code overrides. An explicit PIN block wins; otherwise PIN, city, then state rules apply. New orders reserve stock and await an owner’s shipping quote before payment. Real sales stay disabled until business and provider configuration is confirmed.

## Checks

```sh
make lint
make test
make build
# Chromium must be installed once (or set CHROMIUM_PATH to a local installation):
scripts/pnpm.sh exec playwright install chromium
scripts/test-browser.sh
```

Backend tests guard and reset only `auraflare_test`, exercising actual MySQL transactions and parallel connections. Browser tests explicitly prepare `auraflare_browser`; their random account credentials are private ignored files. The browser profile also isolates its Redis queue/cache prefix and session cookie, with real payments and external mail disabled. Neither suite seeds the actual catalogue. Do not point these fixtures at an existing production database.

`make contract` validates OpenAPI, checks generated Laravel request metadata and validates seven supplied examples plus recorded runtime resource snapshots. After changing the contract, run `scripts/pnpm.sh contract:generate`; commit the contract and both generated outputs together.

## Release and operations

See [configuration](docs/implementation/CONFIG-CHECKLIST.md), [acceptance evidence](docs/implementation/ACCEPTANCE-EVIDENCE.md), [deployment](docs/implementation/runbooks/DEPLOYMENT.md), [payments](docs/implementation/runbooks/PAYMENTS.md) and [backup/recovery](docs/implementation/runbooks/BACKUP-RESTORE.md). `compose.production.yaml` is a private deployment reference with PHP-FPM, a standalone Next.js runtime and a same-origin Nginx edge. It requires an HTTPS ingress, an owned domain, real mail/provider configuration and private persistent storage.

The previous application is preserved at tag `backup-before-fresh-start-2026-10-19`. No legacy SQLite data has been imported. Source changes are on `feat/auraflare-production-rebuild`; deployment and live-provider validation are separate launch steps.
