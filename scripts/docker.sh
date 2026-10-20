#!/usr/bin/env bash
set -euo pipefail
# Match bind-mount ownership on Linux while keeping application processes non-root.
export AURAFLARE_UID="${AURAFLARE_UID:-$(id -u)}"
export AURAFLARE_GID="${AURAFLARE_GID:-$(id -g)}"
if [[ "$AURAFLARE_UID" == 0 ]]; then export AURAFLARE_UID=1000 AURAFLARE_GID=1000; fi
# The managed cloud daemon is local; keep the injected Docker credential config.
if [[ -S /var/run/docker.sock && -d /run/codex-environment ]]; then
  export BUILDX_CONFIG="${BUILDX_CONFIG:-/tmp/auraflare-buildx}"
  exec env -u DOCKER_HOST -u DOCKER_CONTEXT -u DOCKER_TLS -u DOCKER_TLS_VERIFY -u DOCKER_CERT_PATH docker --host=unix:///var/run/docker.sock "$@"
fi
exec docker "$@"
