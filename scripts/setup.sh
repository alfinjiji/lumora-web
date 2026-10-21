#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
umask 077
mkdir -p apps/api/vendor .local apps/api/storage/{app/private,app/public,framework/{cache/data,sessions,views,testing},logs} apps/api/bootstrap/cache
if [[ $(id -u) == 0 ]]; then
  chown -R "${AURAFLARE_UID:-1000}:${AURAFLARE_GID:-1000}" apps/api/vendor apps/api/storage apps/api/bootstrap/cache
fi
if [[ ! -e .env ]]; then
  python3 - <<'PY'
from pathlib import Path
import secrets,base64
s=Path('.env.example').read_text().replace('APP_KEY=\n','APP_KEY=base64:'+base64.b64encode(secrets.token_bytes(32)).decode()+'\n').replace('DB_PASSWORD=\n','DB_PASSWORD='+secrets.token_hex(32)+'\n').replace('MYSQL_ROOT_PASSWORD=\n','MYSQL_ROOT_PASSWORD='+secrets.token_hex(32)+'\n')
Path('.env').write_text(s);Path('.env').chmod(0o600)
PY
fi
# Public CA bundle, never a credential. Preserve TLS verification behind a session proxy.
ca_source=${AURAFLARE_CA_SOURCE:-/etc/ssl/certs/ca-certificates.crt}
if [[ -n ${AURAFLARE_CA_SOURCE:-} && ! -r "$ca_source" ]]; then echo 'AURAFLARE_CA_SOURCE must be a readable trusted bundle.' >&2; exit 1; fi
if [[ -r "$ca_source" ]]; then
  cp "$ca_source" .local/ca.pem
elif [[ ! -s .local/ca.pem ]]; then
  scripts/docker.sh pull php:8.5-cli-bookworm@sha256:819080ed413631f6ec564184dd9acd08d9425bd863b9f8b5876b5ea2147d55e7
  task_container=$(scripts/docker.sh create php:8.5-cli-bookworm@sha256:819080ed413631f6ec564184dd9acd08d9425bd863b9f8b5876b5ea2147d55e7)
  trap 'scripts/docker.sh rm "$task_container" >/dev/null' EXIT
  scripts/docker.sh cp "$task_container:/etc/ssl/certs/ca-certificates.crt" .local/ca.pem
fi
chmod 644 .local/ca.pem
scripts/docker.sh build --secret id=ca,src=.local/ca.pem --target runtime -t auraflare-php:8.5 -f apps/api/Dockerfile .
scripts/docker.sh compose up -d --wait mysql redis mailpit
scripts/docker.sh compose run --rm --no-deps api composer install --no-interaction --prefer-dist
scripts/docker.sh compose run --rm api php artisan migrate --force
scripts/docker.sh compose run --rm api php artisan db:seed --force
scripts/pnpm.sh install --frozen-lockfile
scripts/docker.sh compose --parallel 1 up -d --force-recreate api worker scheduler
scripts/docker.sh compose exec -T api php artisan auraflare:check
printf '%s\n' 'Setup completed. Run make dev for the Next.js development server. Checkout remains configuration-gated.'
