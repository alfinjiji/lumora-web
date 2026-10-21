# Contract 1.0.0 qualification

The supplied 100-operation proposal is the baseline. Qualified changes are explicit:

- Nullable quote/shipment references have an explicit object type so OpenAPI/client tooling can generate correct null unions.
- Guest cart and order security schemes share the host-only session cookie carrier; cart ownership and individual order grants remain separate server-side capabilities.
- Existing-user invitation acceptance requires authenticated matching identity; a new account requires name/password confirmation. Token acceptance never overwrites an existing password.
- Fulfillment projections return empty financial arrays. Optional payment receipt summaries are owner-only.
- Add a private signed proof download operation and a private CSV export download operation. Both require current owner membership.
- Add an explicit owner restock command, separate from cancellation/refund, with expected version, reason and permanent stock-effect uniqueness.
- Add a staff-readable assignee list containing only public ID/name for enquiry assignment.
- Guest-access exchange returns the authorized public order ID so the browser can resume the right order.
- Customer order responses include safe nullable shipment tracking.
- A refund may specify an owner-visible receipt ID to resolve a separately received duplicate payment. It still refunds an entire receipt; there are no partial refunds.

Result: **104 frozen operations**. Inputs reject unknown fields and JSON scalar type mismatches; required arrays/strings may be empty only where the schema permits them. Product options are canonical name/value pairs. The seven supplied examples and recorded runtime projections are validated against the qualified schemas. Generated Laravel metadata and TypeScript client must be updated together.

The freeze hash is in `openapi.sha256`; changing this document’s contract requires updating that hash and the coverage matrix. Browser/static media routes and liveness/readiness are operational routes outside the commerce baseline.
