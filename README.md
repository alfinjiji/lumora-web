# Auraflare — The Candle Studio

A React, TypeScript and Vite implementation of the supplied **Auraflare** storefront. The approved wine/burgundy, ivory and champagne design, nine supplied candle images, eight-product sample catalogue, introduction and shopping interactions are retained. The repository and existing preview address keep their legacy `lumora-web` technical name.

## Develop

Use Node.js **24** (`.nvmrc`) and npm 11:

```bash
npm ci --cache /workspace/.npm-cache --no-audit --no-fund
npm run dev -- --host 0.0.0.0 --port 5173 --strictPort
```

The launcher starts Vite on 5173 and the Node store API on 3001. Vite proxies `/api` to the backend. In a local checkout, `npm ci` and `npm run dev` are sufficient; open Vite’s printed address on that computer. Cloud loopback addresses are for internal checks and are not public previews.

```bash
npm run lint
npm test
npm run build
npm start
```

`npm start` serves the built app and API on port 3001. Restart after backend/configuration changes; the launcher does not watch server code. Preserve `.env.local` and `.data/` when installing or restoring the environment.

## Reference and design

The user-provided `Auraflare-Design-Codex-Reference.zip` is the authoritative reference. Its snapshot revision is `c13891a4c170e88013f5e034c967f083f9e1232c`. The legacy live reference is <https://stillwick-candle-studio.mailfordev97.chatgpt.site/>; the brand is **Auraflare**.

- Full photographic hero, rounded image covers, compact sticky navigation and the source’s final burgundy CSS overrides.
- Quote-first introduction on full loads (about 4.15 seconds, matching the updated prototype); skip, Escape, completion and footer replay. Display fonts receive a bounded 700ms head start before the introduction to reduce font swaps; skip and Escape remain immediately available. Reduced motion bypasses the introduction and disables decorative movement.
- Home, gifting and sculptural filters, featured/price sorting, product dialogs, quick-add, persistent bag, quantities/removal and INR subtotals. Price sorting also remains available on mobile.
- Story, occasions, care FAQ, closing CTA and the supplied footer.
- Demo checkout with explicit simulated completion; event enquiries are previews and send/store no form information.
- Keyboard-operable native dialogs and focus indicators; the focused main landmark has no visible black outline.
- Nine supplied WebP files are copied unchanged. Source/checksum metadata lives in `public/images/auraflare/SOURCES.json`. No new candle imagery was generated. The updated prototype’s Cormorant Garamond display face (normal and italic) and DM Sans UI face are self-hosted with their SIL Open Font Licenses under `public/fonts/`.

The catalogue is illustrative. Confirm actual products, prices, materials, scents, dimensions, burn times, availability, shipping and business terms before accepting real orders. No inventory, customer accounts, newsletter service or email delivery is implied by the preview. The internal `stillwick-bag` storage key intentionally preserves the reference prototype’s bag format; old Lumora product IDs are not mapped to different products.

## Demo and Razorpay checkout

The default experience matches the supplied **demo** checkout. It validates sample form input, clears the demo basket and explicitly states that no real order/payment was created. Demo checkout and enquiry details are neither sent to the API nor persisted. The bag stores only product IDs and quantities in local storage.

The existing Razorpay backend is retained. Real checkout appears only when the server reports it ready. The new catalogue requires **`AURAFLARE_STORE_LIVE=true`** explicitly: the legacy `LUMORA_STORE_LIVE` switch does not enable sales against the new sample catalogue.

Create an ignored `.env.local` from `.env.example` for development. Configure actual server runtime values securely, never in chat or `VITE_` variables:

| Variable | Purpose |
| --- | --- |
| `RAZORPAY_KEY_ID` | Provider publishable key ID; begin with test-mode keys. |
| `RAZORPAY_KEY_SECRET` | Raw server runtime secret for API access and local HMAC verification. |
| `AURAFLARE_STORE_LIVE` | Defaults to false; enable only after confirming the catalogue and business requirements. |
| `AURAFLARE_SHIPPING_INR` | Flat delivery fee; default 0 is a development setting, not an advertised shipping promise. |
| `AURAFLARE_DATA_DIR` | SQLite directory; defaults to `.data`. |
| `RAZORPAY_WEBHOOK_SECRET` | Optional raw secret for signed `payment.captured` callback recovery. |

Legacy `LUMORA_SHIPPING_INR` and `LUMORA_DATA_DIR` remain fallback aliases so existing storage and configuration do not move unexpectedly. Existing order rows and payment references are retained. The legacy session-storage key for interrupted payment verification is also preserved to avoid discarding pending payment references.

Payments use server catalogue prices in paise, validate delivery data, verify HMAC signatures and check captured payment amounts/currency/order IDs. After an interrupted confirmation, retry verification instead of paying again. The optional webhook is `/api/webhooks/razorpay`. Use HTTPS and persistent protected order storage for a real deployment; the implementation expects one Node/SQLite instance. No real provider payment has been made by this task. Backend tests use fixture credentials and mock provider responses.

## Hosted design preview

The existing manual workflow `.github/workflows/design-preview.yml` is **Publish Auraflare design preview**. It builds the app, verifies supplied image checksums and exports a self-contained review before publishing to the existing GitHub Pages project. It never enables payments.

The established preview address is <https://alfinjiji.github.io/lumora-web/>. Check the successful run’s deployment URL when publishing a revision; the existence of a workflow or saved environment draft alone does not establish that a new version is live.

To create the same review locally:

```bash
npm run build
node scripts/export-preview.mjs
```

This writes ignored `auraflare-preview.html`; an explicit output path may be supplied. Images, CSS, JavaScript, favicon and font are embedded. Demo checkout stays functional, while real payment/order API calls are disabled. Credits and source metadata are included. The managed browser may block direct `file:` navigation; validate the exported HTML through a local HTTP server rather than bypassing browser policy.

A full commerce deployment requires the Node backend, provider configuration and persistent storage. GitHub Pages hosts the interactive design review only.

## Studio administration

The attached `Auraflare-Admin-Codex-Reference.zip` is the admin design reference. The React admin is a separate Vite entry at **`/admin`** (`admin.html`), with isolated styles. The existing storefront remains the public entry. The Node server owns all authentication, permissions and writes; the prototype's sample-credential login and localStorage database are not used.

### First owner and recovery

Use the same Node application and database as the store. For local development:

```bash
npm run dev -- --host 0.0.0.0 --port 5173 --strictPort
# In a second terminal:
npm run admin:setup
```

The setup command asks for the owner's email/name and creates a pending owner only when no users exist. It writes a **private HTML invitation preview** under `.data/invitation-previews/` and prints its file path, not the token. Open that file locally and follow its single-use setup link to choose a 12–128 character password. No email is sent and no default credentials exist. Do not commit/share that file or its link in chat.

For production, set **`AURAFLARE_PUBLIC_URL`** to the actual HTTPS application origin before running setup or issuing invitations. Configure the reverse proxy to serve the Node app over HTTPS, use `NODE_ENV=production`, protect/persist the entire data directory, then run `npm ci`, `npm run build`, `npm start`. The default local setup URL is `http://localhost:5173`; configure the origin when using another address. Session cookies are HttpOnly, SameSite=Strict and Secure for a configured HTTPS origin / production mode. Mutations check the request origin, a custom request header and a session CSRF token.

Owners invite staff/owners from Team & access. Each invitation opens a reviewable email preview and a copyable private setup link; delivery is deliberately not configured. Setup links expire after 72 hours and work once. Owners can create one-hour recovery links for active accounts. A server operator can also run `npm run admin:reset` for account recovery. Reset/setup tokens and session identifiers are stored as hashes; passwords use salted scrypt hashes. Deactivation and password changes revoke sessions. The final usable active owner cannot be deactivated or demoted, including when another owner invitation is pending. Email identifiers are read-only because email-change verification is not configured.

### Records and permissions

- **Owners:** all studio operations, product pricing/variants, publishing and account management.
- **Fulfilment staff:** view products, create/manage orders, record shipment/tracking information, adjust stock with reasons, manage internal enquiries and update their own profile. They cannot change prices, publish content, manage accounts or record manual payments. These restrictions are enforced on protected server endpoints.
- **Overview:** actual records, INR, 7/30 calendar-day reporting in Asia/Kolkata. Gross receipts are paid orders created in the selected period, including owner-recorded direct receipts; refunds are not deducted. No sample revenue/customers/orders are seeded into the live database.
- **Catalogue:** the existing eight storefront products migrate into management, with stable default variant IDs. Available stock starts at zero until an initial count is entered. Owners manage categories, collections, descriptions/scent notes, images, SKU, variants, paise prices and active/draft states. Drafts stay out of the public catalogue. Stock history records adjustments and order reservations/releases.
- **Orders:** website Razorpay records and direct WhatsApp/Instagram/phone/in-person orders share the original `orders` table. Direct-order creation uses server prices, reserves stock transactionally and supports idempotent retries. Website checkout also reserves available stock and releases reservations if provider creation fails. Do not enable sales until stock and business terms are confirmed. Abandoned unpaid reservations need studio review/cancellation; automatic reservation expiry is not implemented.
- **Payments/shipping:** website payment confirmation remains exclusively verified by Razorpay. Owners can record an already-received direct cash/bank payment with its exact amount and receipt reference; it is a manual ledger event. Fulfilment cannot progress without payment, and shipment requires carrier/tracking details. Recording shipment does not book a carrier or send a message. Cancellation releases reserved stock once. Refunds must be handled in the payment provider; no refund or carrier-booking service is claimed.
- **Enquiries:** persist contact/channel, assignment, internal notes and follow-up states. No customer messages are sent. The public storefront's explicitly simulated enquiry form remains a demonstration; it does not silently begin collecting personal data.
- **Website content:** draft and published hero copy, announcement, button label, featured category and campaign image. Saving a draft does not change the public site. Publishing updates `/api/store` and the storefront served by this Node instance. Static design reviews use the bundled sample catalogue/copy and do not consume live CMS or database changes.
- **Photos:** server-validated still JPEG/PNG/WebP, up to 2 MB for avatars and 5 MB for product/banner uploads; decoded with a pixel limit, stripped/re-encoded as WebP and resized. Avatars use authenticated delivery; product/banner media uses public `/media/<uuid>.webp` URLs. Avatar details and personal form data are not stored in localStorage.

Admin tables are added transactionally and idempotently in the **same existing SQLite database** (`studio_migrations` version 1); existing order rows/payment references are preserved. Do not create a separate database or delete/reset `.data`. Back up the SQLite database and uploaded media together. This deployment uses one Node/SQLite instance; it does not provide distributed storage or external identity/email/shipping services.

### Admin design review

```bash
npm run build
node scripts/export-preview.mjs review-pages/index.html
node scripts/export-preview.mjs review-pages/admin-preview.html --admin
node scripts/export-preview.mjs review-pages/admin.html --admin-login
```

Create `review-pages` first when exporting there. The existing manual Pages workflow performs these commands automatically. The public **`admin-preview.html`** explicitly opens a read-only sample workspace without accepting credentials. It supports navigation, filters, details and responsive content previews, while writes/uploads/invitations remain disabled. The static **`admin.html`** shows the real login design and accurately refuses sign-in without a Node backend. Neither export is a production authentication deployment or a route to live records. Shared JS modules, fonts, approved images and licenses are embedded; no backend/asset requests are needed for the read-only review.

The 29-test backend suite now includes authentication, authorization, unique/expiring invitations, final-owner protection, deactivation, profile/password changes, validated uploads, variants/SKUs, stock history, atomic/idempotent orders, payment boundaries and content publication. Browser review includes all screens, native dialog focus, mobile navigation, and growing hero-copy previews at 320/360/390/430/768/1024/1440px.
