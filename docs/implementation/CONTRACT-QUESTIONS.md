# Contract qualification and business decisions

The original proposal was validated and corrected before the implementation freeze. contracts/CHANGELOG.md records the qualified 104-operation contract and contracts/openapi.sha256 records its hash.

Resolved technical boundaries:

- Invitations have two paths: an authenticated matching existing account, or new-user setup with name/password confirmation. Token-only acceptance cannot reset existing credentials.
- Public versus admin resources are explicit projections. Fulfillment staff receive empty financial arrays and never receive owner receipt summaries. Assignee lookup exposes public ID/name only.
- Guest cart ownership and individual order access are separate server capabilities carried by the host-only session cookie. The contract no longer promises a second cookie that the application does not set.
- Nullable referenced schemas and runtime empty arrays/nullable shipping values are qualified against client generation and response validation.
- Idempotency scope includes principal, route and target. Financial provider calls have separately persisted intent/unknown/reconciliation states; HTTP retries do not provide provider exactly-once guarantees.
- Customer shipment tracking, private binary downloads, explicit physical restock and receipt-specific excess-payment refund require small documented contract extensions.
- Required JSON numbers/booleans are strict, including nested array fields. Unknown inputs are rejected. Schema-permitted empty strings/option arrays remain valid.

Confirmed by the user: Kerala launch with UI-managed cities/PIN codes; empty real catalogue and isolated development fixtures; portable deployment while hosting/mail are undecided. The existing Razorpay-for-INR choice is retained.

Still required for production launch: real catalogue/assets/rights, tax and invoice policy, shipping-review and hold SLAs, manual payment destination if offered, mail provider/sender, hosting/domain/storage/scanner, privacy/retention and operational ownership. These do not block local implementation and do not get invented production values.
