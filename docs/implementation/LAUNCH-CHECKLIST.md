# Launch checklist

Local implementation and synthetic tests are complete independently of production launch. Keep CHECKOUT_ENABLED=false until these items are reviewed by the business/operator.

- Enter real products, variant options/SKUs, INR prices, actual ready stock and owned/licensed photographs. Confirm editorial asset usage rights; approved design assets are not automatically a commercial stock licence.
- Review the Kerala state allowance and city/PIN overrides in Delivery areas. PIN prefix checks are not a complete postal address verification service; confirm the carrier/address while quoting. Confirm delivery precedence, shipping-review SLA and reservation/payment/manual-review windows.
- Confirm tax/GST/invoice requirements, applicable tax policy/rate, order/cancellation/refund terms, privacy and retention. The application has no invented tax identity or business registration.
- Choose hosting and an owned HTTPS domain. Configure the canonical URL, production application key, secure sessions, actual trusted ingress CIDR and private database/Redis/service networking. Run production configuration checks; qualify readiness with background services.
- Configure Razorpay test credentials/webhooks securely and qualify real-provider captured/failed/authorized, duplicate/replayed/out-of-order webhook, timeout, late capture and full refund cases. Then configure separate live credentials and controlled live validation. A provider dashboard success alone must not bypass application reconciliation.
- If offering manual payments, configure the actual verified payee/destination and an independent funds-checking process. Proof screenshots remain optional, quarantined and never proof of money received. Qualify the real ClamAV deployment before proof attachment/download is offered.
- Configure and qualify transactional email with the chosen provider/sender. Monitor the outbox and retries; approve retention and access to private previews/exports/proofs. No real mail was sent as part of the local implementation.
- Qualify persistent local media or a real private S3 bucket/IAM/encryption/lifecycle. Configure encrypted offsite backups, retention, MySQL binlogs if required and a restore drill with agreed RPO/RTO.
- Configure worker/scheduler/failed-job, old inbox/outbox, payment exception, overdue review, low-stock and backup alerts in hosting. Assign an operator to financial exceptions; unresolved failures require reconciliation/provider investigation, never blind repeated charges/refunds.
- Review the local branch/commits, authorize remote publication/hosting when ready, deploy matching web/API/worker releases and verify the real HTTPS/mobile/customer journeys. Only then set BUSINESS_CONFIG_APPROVED=true and CHECKOUT_ENABLED=true.

No live credentials, public deployment, external email, charge or production owner account was created by the implementation checks. CI is supplied; a hosted GitHub Actions run is separate from locally running its constituent commands.
