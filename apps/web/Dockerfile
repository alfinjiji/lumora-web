# syntax=docker/dockerfile:1
FROM node:24.19.0-bookworm-slim@sha256:a9f5f7c91a432850b2a8a7797adf5eadb6c733ceed61167806cee7ea7fbc29df AS build
WORKDIR /app
ARG API_INTERNAL_URL=http://edge:8080
ARG PUBLIC_SITE_URL=http://localhost:8080
ENV API_INTERNAL_URL=$API_INTERNAL_URL PUBLIC_SITE_URL=$PUBLIC_SITE_URL NEXT_TELEMETRY_DISABLED=1
# One network/build layer avoids duplicating a dependency tree on vfs cloud daemons.
RUN --mount=type=secret,id=ca,mode=0444 \
    --mount=type=bind,target=/run/source,readonly \
    set -eu; \
    if [ -s /run/secrets/ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/ca; fi; \
    cp /run/source/package.json /run/source/pnpm-lock.yaml /run/source/pnpm-workspace.yaml ./; \
    mkdir -p apps packages; cp -R /run/source/apps/web apps/web; cp -R /run/source/packages/api-client packages/api-client; \
    npm exec --yes pnpm@10.28.2 -- install --frozen-lockfile; \
    npm exec --yes pnpm@10.28.2 -- build; \
    mkdir -p /release; cp -R apps/web/.next/standalone/. /release/; \
    cp -R apps/web/public /release/apps/web/public; \
    cp -R apps/web/.next/static /release/apps/web/.next/static; \
    rm -rf /app/* /root/.npm /root/.local/share/pnpm
FROM node:24.19.0-bookworm-slim@sha256:a9f5f7c91a432850b2a8a7797adf5eadb6c733ceed61167806cee7ea7fbc29df AS production
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
COPY --from=build --chown=node:node /release/ ./
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
