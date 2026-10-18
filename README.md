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
- Quote-first introduction on full loads; skip, Escape, completion and footer replay. Reduced motion bypasses the introduction and disables decorative movement.
- Home, gifting and sculptural filters, featured/price sorting, product dialogs, quick-add, persistent bag, quantities/removal and INR subtotals. Price sorting also remains available on mobile.
- Story, occasions, care FAQ, closing CTA and the supplied footer.
- Demo checkout with explicit simulated completion; event enquiries are previews and send/store no form information.
- Keyboard-operable native dialogs and focus indicators; the focused main landmark has no visible black outline.
- Nine supplied WebP files are copied unchanged. Source/checksum metadata lives in `public/images/auraflare/SOURCES.json`. No new candle imagery was generated. DM Sans is self-hosted with its SIL Open Font License under `public/fonts/`.

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
