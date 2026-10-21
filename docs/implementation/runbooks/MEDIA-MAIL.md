# Media, proof scanning and email

JPEG/PNG/WebP uploads are decoded, bounded, resized and re-encoded. Avatars stay private; catalogue/content media are served through the application only when active/published or authorized for owner preview. PDF proof is private. Proof uploads start processing when scanner access is unavailable; no pending file can be attached for review/download. Exact ClamAV clean verdicts mark ready, infected verdicts reject. `auraflare:scan-proofs` retries pending scans; the scheduler runs it every five minutes.

Connect ClamAV over the private service network, configure PROOF_SCANNER/CLAMAV_HOST/CLAMAV_PORT, and qualify clean/infected/oversized/outage cases in the chosen hosting. Keep signature updates and scanner monitoring supervised. An error or incomplete scanner response must remain pending. Do not bypass the scanner to open a customer attachment.

`auraflare:prune-uploads` removes only non-proof, unattached uploads older than seven days, after checking live catalogue/avatar references. Financial proof/history is retained pending an approved business retention policy. Downloads require current owner access, clean media and a five-minute signed link. Revoking membership removes access immediately.

For object storage, configure the S3 disk and set MEDIA_PUBLIC_DISK/MEDIA_PRIVATE_DISK as needed. Keep the bucket private; the names “public” and “private” refer to application purposes, not a recommendation for public bucket ACLs. Qualify actual IAM, encryption, region, lifecycle, backup and download behaviour. The optional `storage-test` profile uses Moto with explicit synthetic credentials for an isolated SDK check; it is never a production storage server.

External mail defaults off. `auraflare:work-outbox` writes private previews in storage/app/private/mail-previews. They contain secret single-use links: do not attach them to a ticket, commit them or expose that directory through the web server. Mailpit is available locally for later SMTP capture, but external mail remains disabled unless explicitly configured. Provider delivery is at least once; monitor duplicates and unresolved pending messages.
