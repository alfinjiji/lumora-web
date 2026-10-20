# Payment operations

The customer first submits an order request. An owner confirms shipping and issues an expiring final quote. Payment requires the current quote/version and explicit acceptance. Never declare payment from a browser callback, authorization event, screenshot or customer claim.

For Razorpay, provision separate test/live credentials securely, configure the raw-body webhook endpoint `/webhooks/razorpay`, and use captured payment facts. The browser signature, provider order, amount and INR currency must match. Webhook inbox records are committed before ACK; a queue outage leaves the event pending for the scheduler. Unknown signed events are safely retained. Replays share the settlement action and permanent receipt uniqueness.

A create/refund timeout is ambiguous. Inspect the internal attempt/refund and use owner “Check provider payment status” or `php artisan auraflare:reconcile`. Do not create another provider order or send a second refund to “fix” a timeout. Scheduled reconciliation uses the internal receipt/reference. Authorized states stay unpaid. A delayed failed event cannot undo a captured receipt. If every observed payment definitively failed, a new payment attempt is permitted; a later old-order capture still enters the exception workflow.

Late, excess or stale-quote money is a payment exception. The owner reviews the receipt in the order detail. Full-receipt refunds use the selected verified receipt and wait for provider processed status or independently completed manual transfer. No partial refunds or partial shipments are supported. Refunds do not automatically cancel an order or restock goods. After cancellation, an owner may separately record a physically inspected, unshipped stock return once.

For manual payments, configure the real payee, destination and instructions. The owner checks the bank/payment account independently, records the exact received amount, bank reference and actual received date, then approves evidence. Rejecting evidence keeps the order unpaid. An optional proof stays quarantined until a clean scanner verdict; private downloads require a fresh signed URL and current owner membership.

Unresolved financial exceptions must be investigated before fulfillment. Use the audit trail and external provider dashboard, reconcile before retrying, and never edit stock/receipt database rows to force a green status. Real Razorpay end-to-end qualification remains a launch requirement; automated tests use a synthetic gateway adapter.
