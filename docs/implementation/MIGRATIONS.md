# Migration dependency and recovery checklist

| Migration | Depends on | State introduced |
|---|---|---|
| 0001 users | MySQL 8.4 | Users and database sessions |
| 0001 cache/jobs | Users independent | Cache/queue fallback tables |
| 000100 studio tables | Users | Identity lock/memberships/invitations/tokens; media; products/variants/collections; balances/movements; delivery; carts; immutable order snapshots/quotes/reservations; payment attempts/evidence/refunds; shipment; enquiries; content revisions/pointer; audit/idempotency/outbox/inbox/exports |
| 000110 cart owner key | Carts | Unique active cart owner key; submitted carts lose their active key |
| 000120 payment receipts | Attempts/refunds | Permanent unique external receipt identity; refund bound to a receipt |

All business tables use InnoDB and foreign keys. Balance constraints enforce nonnegative on-hand/reserved and reserved ≤ on-hand. SKU, canonical option combinations, provider identities, receipt identities, stock effects and membership/user identities are unique where their business operation requires it.

Apply migrations forward against a private restored copy first, then the stopped/intake-gated production release. The initial deployment runs migrate --force and the empty-catalogue delivery seeder. Re-running migrate on the actual development database reported nothing to migrate. Do not import the old SQLite database. Synthetic reset/restore schemas are explicitly separate and guarded.

Keep order/financial history when rolling application code back. Destructive migration downs are not a recovery procedure. See runbooks/BACKUP-RESTORE.md for consistent snapshot/restore and external payment reconciliation requirements.
