#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
# Only this isolated schema is disposable; production/development schemas are never reset.
scripts/docker.sh compose exec -T mysql sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot -e "CREATE DATABASE IF NOT EXISTS auraflare_test; GRANT ALL PRIVILEGES ON auraflare_test.* TO '\''auraflare'\''@'\''%'\'';"'
scripts/docker.sh compose exec -T api vendor/bin/phpunit "$@"
