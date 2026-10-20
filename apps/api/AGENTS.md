# Auraflare API

Follow the repository [AGENTS.md](../../AGENTS.md), implementation plan and status record. The Laravel scaffold bootstrap is complete. PHP and Composer run in the pinned Docker runtime; no host installation or additional AI tooling is needed for this repository.

Run from the repository root using scripts/docker.sh. Business operations belong in module Actions, request validation comes from the frozen contract, own/guest order access uses OrderPolicy and role boundaries use capability middleware. Keep money/stock facts server-authoritative and permanent receipt/movement effects unique.

Use scripts/test-api.sh for the guarded MySQL test schema, vendor/bin/pint for formatting and vendor/bin/phpstan for static checks inside the API container. Never substitute SQLite for the transaction/concurrency tests. TestCase and browser fixtures isolate storage, queues and outbound providers; retain those guards.

No default production owner, catalogue, password, email delivery or live payment is seeded. Keep private proof, mail previews, exports, runtime settings and backups outside Git.
