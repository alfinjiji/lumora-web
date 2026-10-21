# Auraflare development

Read README.md and docs/implementation/STATUS.md first. The approved visual sources are in design-reference; the implementation plan is docs/implementation/PLAN.md. Keep the Next.js storefront/admin design consistent with those supplied references.

Use this existing checkout; do not create a worktree unless the user requests it. Run commands from the repository root. Use scripts/docker.sh and scripts/pnpm.sh so managed cloud proxy, CA trust and writable dependency caches are respected. Never disable TLS/package verification or overwrite Docker credentials.

Laravel/MySQL is authoritative for prices, stock, permission checks, order state and received payments. Browser state cannot declare an order paid. Store money in INR paise and financial effects in unique immutable receipts/movements. Keep stock lock ordering: sorted balances, order, reservation, quote/attempt. External gateway calls run outside database locks; ambiguous calls are reconciled before retry.

Keep production seeds empty except the confirmed Kerala delivery policy. Synthetic fixtures belong only in guarded test databases. Do not commit `.env`, account files, proof files, mail previews, private exports, backups or database dumps. No default owner password. Do not send external mail, charge a payment, publish or deploy unless the task authorizes it.

After contract changes run contract:generate and make contract. For backend business changes run scripts/test-api.sh and PHP static analysis; for frontend changes run typecheck/lint/build and the relevant browser journey. Do not claim live Razorpay, real cloud storage or fresh-task restoration has been qualified from fake/emulator/local checks.
