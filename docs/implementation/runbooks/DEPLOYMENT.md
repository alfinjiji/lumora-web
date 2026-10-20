# Portable deployment

1. Review CONFIG-CHECKLIST.md. Keep checkout disabled while qualifying the environment. Configure an owned HTTPS APP_URL/PUBLIC_SITE_URL, debug off, Secure session cookies and an application key kept outside the image. Preserve the application key across releases; encrypted outbox tokens need it after restore.
2. Build the PHP runtime and release images using the committed locks:

   ```sh
   scripts/docker.sh build --target runtime -t auraflare-php:8.5 -f apps/api/Dockerfile .
   scripts/docker.sh build --target production -t auraflare-api:production -f apps/api/Dockerfile .
   scripts/docker.sh build --target production --build-arg API_INTERNAL_URL=http://edge:8080 --build-arg PUBLIC_SITE_URL=https://YOUR_OWNED_DOMAIN -t auraflare-web:production -f apps/web/Dockerfile .
   ```

   Behind a managed TLS proxy, add `--secret id=ca,src=.local/ca.pem` to each build. Use the combined trusted CA bundle; never disable TLS. For runtime traffic behind the managed proxy, add `-f deploy/compose.proxy.yaml` after the release Compose file; it mounts the same public CA bundle and sets AURAFLARE_CA_BUNDLE for PHP/cURL/OpenSSL. Normal hosting uses the image’s system roots. Build arguments never contain provider secrets. Store signed/versioned images in the chosen registry only after publication is authorized.
3. `compose.production.yaml` demonstrates same-origin Nginx → Next.js / PHP-FPM routing. Keep port 8080 private behind an HTTPS ingress. The PHP/MySQL/Redis ports must not be publicly exposed. The canonical domain must reach that ingress. `FASTCGI_HTTPS=on` is the production default so Laravel signed download requests use the external HTTPS scheme. Only local HTTP rehearsal uses `off`. Set TRUSTED_INGRESS_CIDR to the actual private ingress address/range so IP rate limits see customers correctly. The default trusts loopback only; never trust arbitrary forwarded headers or a universal network range.
4. Configure persistent MySQL, Redis and `/app/storage/app`, or set both media disk selectors to a private S3 disk. The local filesystem remains necessary for private mail previews and exports. Do not expose a storage symlink or a public proof bucket. Back up before every migration.
5. Start database/Redis, run `php artisan migrate --force`, then `php artisan db:seed --force` once for the confirmed Kerala policy. Never run migrate:fresh on a deployed database. Run `php artisan auraflare:check --production`. Deploy web/API/worker/scheduler from the same contract release. Restart workers after each source change; do not let old worker code run against a newer incompatible schema.
6. Supervise workers and the singleton scheduler. Enable REQUIRE_BACKGROUND_HEALTH after their first heartbeat. `/up` is application liveness; `/ready` checks DB, Redis, configured media disks, production settings and optional background freshness. Expose readiness through the ingress only as a generic status. Alert on repeated 503s, failed jobs, old outbox/inbox rows and unresolved money.
7. Bootstrap the first owner privately using `auraflare:owner`. Deliver the private invitation via the configured mail workflow or inspect its local preview. No account is silently seeded.
8. Before opening checkout, qualify Razorpay test capture/failure/webhook/replay/timeout/refund against the real provider, qualify email delivery and the actual storage/scanner deployment, enter real catalogue data and complete the business launch checklist. Only then set production live keys, BUSINESS_CONFIG_APPROVED=true and CHECKOUT_ENABLED=true.

The source is not a public deployment. GitHub Pages is unsuitable for this Laravel/MySQL application. The local container rehearsal does not prove a hosting provider, DNS, HTTPS ingress, real S3 permissions or live Razorpay credentials.
