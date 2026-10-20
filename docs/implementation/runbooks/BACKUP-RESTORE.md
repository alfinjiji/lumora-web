# Backup, restore and migration recovery

Run `scripts/backup.sh /ABSOLUTE/PRIVATE/NEW/DIRECTORY`. It creates a consistent InnoDB snapshot, a local media archive, the private runtime settings needed to recover APP_KEY and checksums. Directory/files use restrictive permissions. Encrypt offsite copies, restrict operator access and define retention with the business. S3 objects require versioning/backup in addition to this local-volume archive.

For a live production backup, adapt the same commands to the release Compose project or managed database tools. Pause catalogue/media mutations during the media copy if a point-in-time database/media pair is required. Retain MySQL binlogs for the chosen RPO; this script alone provides a consistent DB snapshot, not coordinated point-in-time object storage recovery.

Run `scripts/rehearse-restore.sh PRIVATE_BACKUP_DIRECTORY` to verify checksums and restore into the fixed disposable `auraflare_restore_rehearsal` schema plus `.local/restore-media`. It never replaces the application database/media. Compare order/movement/receipt counts, foreign keys and sampled object hashes before trusting a backup. A rehearsal must not send email, replay pending financial operations or call a real gateway.

Actual disaster recovery is an operator procedure: stop intake/workers, isolate the new database/storage, restore the snapshot and matching objects, restore the same APP_KEY securely, deploy the matching application release, verify readiness and invariants, then reconcile provider facts before resuming jobs/intake. Never start two active payment workers against divergent restored databases. Rotate exposed credentials when recovering a compromised environment.

For schema releases use additive/forward migrations, run them against a restored disposable database first, and keep old/new application versions compatible during the rollout. A failed release normally rolls application images back while retaining forward-compatible schema. Do not execute destructive migration downs over financial history. If restoration is necessary, preserve post-backup provider events and reconcile received funds before reopening sales.

Rehearsal in this task restored synthetic orders and inventory movements into a disposable schema and extracted local media separately. No actual application data was replaced. Real offsite recovery, RPO/RTO and object-store restore remain deployment-specific qualification.
