#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
scripts/browser-fixtures.sh
exec scripts/pnpm.sh exec playwright test "$@"
