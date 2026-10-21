#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ -d /run/codex-environment ]]; then
  export npm_config_store_dir="${AURAFLARE_PNPM_STORE:-/workspace/.pnpm-store}"
else
  export npm_config_store_dir="${AURAFLARE_PNPM_STORE:-$PWD/.local/pnpm-store}"
fi
if command -v pnpm >/dev/null && [[ $(pnpm --version) == 10.28.2 ]]; then exec pnpm "$@"; fi
exec npm --cache "${AURAFLARE_NPM_CACHE:-${TMPDIR:-/tmp}/auraflare-npm-cache}" exec --yes pnpm@10.28.2 -- "$@"
