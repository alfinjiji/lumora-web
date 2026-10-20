# Configuration and launch inputs

| Setting | Development default | Production decision required |
|---|---|---|
| Catalogue | Empty | Real names, variants, prices, stock, photographs and usage rights |
| Delivery | Kerala, city/PIN owner overrides; Kerala PIN prefixes 67–69 | Review precedence, enabled areas and shipping-review SLA |
| Checkout | Disabled | Enable only after the business reviews configuration |
| Tax | Unset | Confirm `none` or `exclusive`, basis points, invoices/GST requirements |
| Hold windows | Review 24h, payment 24h, manual 48h | Confirm operational staffing/SLA; configurable |
| Razorpay | Disabled | Separate test/live keys and webhook secret; captured-payment/refund qualification |
| Manual payments | Unset | Verified actual payee/destination/instructions; no sample account details |
| Mail | External delivery off | Provider, verified sender, domain authentication, retries and monitoring |
| Domain/TLS | Loopback HTTP | Owned HTTPS domain, canonical APP_URL/PUBLIC_SITE_URL, ingress and signed-link routing |
| Sessions | Database, host-only, SameSite Lax | Secure cookie true, debug false, unique APP_KEY stored securely |
| Media | Persistent local private/public disks via API | Durable local volume or private S3 bucket/IAM/backup/lifecycle; scanner service if accepting proofs |
| Background services | Redis worker and singleton scheduler | Supervision, heartbeats, alerts and failure recovery ownership |
| Privacy/retention | Proofs/financial records retained | Adopt retention policy, access process and encrypted offsite backups |

No real credentials belong in Git or chat. Enter them through the hosting environment’s secure settings. `BUSINESS_CONFIG_APPROVED=false` adds a production guard: changing CHECKOUT_ENABLED alone cannot open sales. The release Compose file forces production mode, debug off, secure host-only sessions and background health checks; its default HTTP development URL fails production readiness until an HTTPS deployment is configured. `auraflare:check --production` reports configuration names only. It does not prove gateway, email or hosting behaviour.

Optional manual proof files remain unavailable while `PROOF_SCANNER=disabled`; customers can submit a reference without an attachment. The scanner must connect to a private ClamAV INSTREAM service when enabled. No proof download becomes available merely because a file was uploaded.
