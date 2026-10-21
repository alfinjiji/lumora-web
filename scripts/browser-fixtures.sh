#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
umask 077
mkdir -p .local/browser
if [[ $(id -u) == 0 ]]; then chown -R "${AURAFLARE_UID:-1000}:${AURAFLARE_GID:-1000}" .local/browser; fi
scripts/docker.sh compose exec -T mysql sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot -e "CREATE DATABASE IF NOT EXISTS auraflare_browser; GRANT ALL PRIVILEGES ON auraflare_browser.* TO '\''auraflare'\''@'\''%'\'';"'
scripts/docker.sh compose run --rm --no-deps -e APP_ENV=testing -e DB_DATABASE=auraflare_browser -e REDIS_PREFIX=auraflare_browser_ -e CACHE_PREFIX=auraflare_browser_cache_ -e REDIS_QUEUE=auraflare_browser -e EXTERNAL_MAIL_ENABLED=false -e RAZORPAY_MODE=disabled -e MEDIA_PUBLIC_DISK=public -e MEDIA_PRIVATE_DISK=local -e BROWSER_ACCOUNTS_PATH=/browser-output/browser-accounts.json -v "$PWD/apps/web/public/images/design:/fixtures:ro" -v "$PWD/.local/browser:/browser-output" api php tests/Support/browser-fixtures.php
scripts/docker.sh compose --profile browser up -d browser-api
