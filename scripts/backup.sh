#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
umask 077
backup_dir=${1:-.local/backups/$(date -u +%Y%m%dT%H%M%SZ)}
backup_db=${AURAFLARE_BACKUP_DATABASE:-auraflare}
[[ "$backup_db" == auraflare || "$backup_db" == auraflare_browser ]] || { echo 'Unsupported source database' >&2; exit 1; }
[[ ! -e "$backup_dir" ]] || { echo 'Use a new backup directory' >&2; exit 1; }
mkdir -p "$backup_dir"
scripts/docker.sh compose exec -T -e AURAFLARE_BACKUP_DATABASE="$backup_db" mysql sh -c 'MYSQL_PWD="$MYSQL_PASSWORD" mysqldump -uauraflare --single-transaction --quick --no-tablespaces --set-gtid-purged=OFF "$AURAFLARE_BACKUP_DATABASE"' | gzip > "$backup_dir/database.sql.gz"
scripts/docker.sh compose exec -T api tar -C storage/app -czf - . > "$backup_dir/local-media.tar.gz"
# APP_KEY is necessary to restore encrypted tokens. Protect this private file separately offsite.
cp .env "$backup_dir/runtime.env"
(cd "$backup_dir" && sha256sum database.sql.gz local-media.tar.gz runtime.env > SHA256SUMS)
printf '%s\n' 'Consistent MySQL and local media backup completed. Keep the directory private and encrypt offsite copies.'
