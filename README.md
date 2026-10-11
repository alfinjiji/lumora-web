# Lumora — Find your glow

A responsive candle portfolio and storefront built with React, TypeScript, Vite, and a Node.js / SQLite backend. Prices are in Indian rupees.

## Features

- A photographic After Dark layout with an approved full-screen campaign image and distinct photo placements.
- Native-scroll photo parallax, perspective depth, pointer tilt, and reduced-motion support.
- Scent filters, product details, responsive navigation, brand story, candle care, and FAQ.
- A browser-persistent shopping bag with quantity controls and INR totals.
- A delivery form and Razorpay checkout with server-calculated amounts.
- HMAC signature checks, provider-side payment lookup and capture, idempotent payment confirmation, and signed webhook recovery.
- SQLite order records, plus a retry flow for interrupted payment verification.

## Development

Use Node.js 24 (tested version in `.nvmrc`) and npm 11. Node's built-in SQLite and TypeScript support are used by the backend.

```sh
npm ci
npm run dev
```

This starts the Vite frontend and the store backend together. Vite proxies `/api` to port 3001. Open the address printed by Vite; the source `index.html` needs compilation and cannot be opened directly as a standalone page.

```sh
npm run lint
npm test
npm run build
```

The 12 backend tests use local fixtures, not live payments. They cover price tampering, invalid quantities and delivery data, forged signatures, capture failure, repeated callbacks, signed webhooks, upstream errors, and database persistence. Desktop/mobile browser checks were also run for shopping, checkout UI, payment retries and reduced-motion behavior.

## Razorpay configuration

Checkout is disabled by default. The sample catalog in `src/products.ts` must be replaced or confirmed before accepting real payments. Confirm product names, prices, ingredients, sizes, burn times, stock, delivery costs, taxes, contact details, return terms, and fulfilment. Product prices are treated as tax-inclusive.

Use secure environment settings for server credentials, or copy `.env.example` to the ignored `.env.local` for local development. Never commit real credentials or put them in `VITE_` variables.

| Variable                  | Purpose                                                                                                               |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `RAZORPAY_KEY_ID`         | Razorpay publishable key ID; start with test-mode credentials.                                                        |
| `RAZORPAY_KEY_SECRET`     | Raw server-side secret for API authentication and HMAC verification.                                                  |
| `LUMORA_STORE_LIVE`       | Set to `true` only after confirming the catalog and store terms. This enables checkout, including Razorpay test mode. |
| `LUMORA_SHIPPING_INR`     | Flat delivery charge in INR; defaults to 0. Confirm the actual charge.                                                |
| `RAZORPAY_WEBHOOK_SECRET` | Optional raw signing secret for payment callback recovery.                                                            |
| `LUMORA_DATA_DIR`         | Persistent order-data directory; defaults to `.data`.                                                                 |
| `PORT`                    | Backend port; defaults to 3001. Keep 3001 for the default Vite proxy.                                                 |

Signature verification runs locally, so `RAZORPAY_KEY_SECRET` and the optional webhook secret must be actual server runtime secrets, not network-proxy placeholders. Restart the backend after changing configuration. The public key ID is returned to the browser only when checkout is enabled; server secrets are never returned.

Test Razorpay checkout with provider test credentials before switching to live keys. No live or provider sandbox payments have been tested in this environment because credentials are not supplied. Browser tests use a mocked SDK; backend tests use mocked provider responses.

For optional callback recovery, configure a Razorpay `payment.captured` webhook to the deployed HTTPS `/api/webhooks/razorpay` endpoint and set its signing secret. The handler validates the raw-body HMAC and the stored order's amount/currency before updating its status. Repeated callbacks are idempotent.

## Production

```sh
npm ci
npm run build
npm start
```

The Node server serves both the built website and API on port 3001. Deploy behind HTTPS, use persistent storage for `.data`, and back up order records. The database contains customer delivery information; restrict access and apply your retention policy. This implementation suits a single server instance; production stock management, fulfilment tools, customer notifications, and approved store policies still need to be supplied.

Payments are created in paise from the server's catalog; browser prices are never trusted. An order is confirmed only after signature verification and a matching captured Razorpay payment. After an interrupted confirmation, customers can retry verification of the existing payment rather than paying again.

The newsletter form is a preview only; it does not send or store email addresses. The current layout uses photographic depth effects and does not load the earlier WebGL model.

## Main files

- `src/App.tsx`: brand sections, catalog filters, dialogs, and shopping bag.
- `src/products.ts`: shared sample catalog and INR formatting.
- `public/images/photography/`: seven distinct stock photographs and `SOURCES.json` provenance.
- `src/components/Checkout.tsx`: delivery form, SDK handoff, and confirmation retries.
- `server/store.mjs`: order calculation, signature verification, capture, and webhooks.
- `server/index.mjs`: HTTP API and production static server.
- `server/store.test.mjs`: payment-handling tests.

## Codex cloud development

Use the existing checkout at `/workspace/lumora-web`; cloud tasks already run in isolated environments, so a separate Git worktree is unnecessary.

```sh
cd /workspace/lumora-web
npm ci --cache /workspace/.npm-cache --no-audit --no-fund
npm run dev -- --host 0.0.0.0 --port 5173 --strictPort
```

Installation needs `registry.npmjs.org`. Payment integration needs `api.razorpay.com`; the customer browser loads `checkout.razorpay.com`. Those domain additions and runtime-variable requirements are saved in the environment draft. Saving a draft does not apply networking, inject credentials, or publish the environment.

Restart frontend/backend processes in new tasks. Readiness checks are the hero, product filters, cart, and `/api/health`; a running port alone is insufficient. Missing Razorpay credentials leave the portfolio and cart available while checkout remains disabled.

## After Dark photography revision

The page now uses a full-screen campaign hero, an ivory scent collection, a photographic brand story, a full-width evening ritual, an editorial gifting section, care guidance, FAQs, newsletter preview, and matching shopping dialogs. Native scroll changes photo offsets and perspective; there is no wheel interception. Pointer movement tilts product cards. Reduced-motion preferences disable these transforms.

The user's approved `public/images/after-dark-story.webp` appears once in the hero. It is an AI-generated campaign illustration, not original Lumora photography. All seven other image placements use separate photographic assets: four catalog moods, Our world, the evening ritual, and gifting. Product details and cart entries use scent typography rather than repeat those images. Stock photographs represent styling and scent moods, not actual Lumora products; the sample catalog must be confirmed before launch.

The seven photographic assets are now present. `public/images/photography/SOURCES.json` records sources, the Unsplash License link, available photographer attributions, and unique SHA-256 hashes. Five files come from credited Unsplash downloads preserved in a public source repository; two are downloaded directly from the Unsplash image CDN. Some visible labels belong to the stock-photo brands. They are not Lumora packaging. Unsplash photo pages require an access challenge, so missing photographer names are explicitly recorded as unavailable rather than inferred. The photo-credits page links to the sources.

Instagram references supplied by the user: [gocthom\_](https://www.instagram.com/gocthom_/) and [elora_craft_studio](https://www.instagram.com/elora_craft_studio/). Public profile metadata could be read, but post images were unavailable without further access. Do not claim those posts were visually reviewed. Original product images supplied by the user can later replace the temporary stock photography.

### Downloadable interactive design review

To create a single HTML file that opens directly in a browser without installing Node on the viewer's computer:

```sh
npm run build
node scripts/export-preview.mjs
```

Open the generated `lumora-preview.html`. All images, CSS, and application JavaScript are embedded. Product filters, scent details, cart quantities, and native-scroll depth work. The exported file explicitly disables payments and uses a preview-only shop response; it is a design review, not a deployed storefront. The normal application still uses its real backend. Image credits are embedded below the page. No server or third-party asset requests are needed to view the file.

### Hosted design preview with GitHub Pages

The manual `.github/workflows/design-preview.yml` workflow publishes the same interactive review through GitHub Pages. It does not run automatically or enable real payments. In the repository's **Settings → Pages**, select **GitHub Actions** as the source. Then open **Actions → Publish Lumora design preview → Run workflow**. After deployment succeeds, use the URL reported by that workflow. The workflow has been prepared and its YAML checked locally; no GitHub deployment or public preview has been confirmed from this cloud task.

A complete ecommerce deployment still needs the Node backend, secure Razorpay runtime credentials, and persistent order storage. The Pages workflow hosts the explicitly marked design review.

## Viewing a live preview

For a live preview on your own computer, clone the repository, install Node.js 24, run `npm ci`, then `npm run dev`. Open the local address printed by Vite in that computer’s browser. Keep the command running while viewing; changes reload automatically.

A localhost server in the cloud environment is not a public website. A Codex browser-panel request is not proof of port forwarding or browser access; the current task reports no preview capability. A shareable Internet preview requires a successful deployment, such as the manual Pages workflow above, or supported cloud port forwarding. Publishing the environment configuration does not deploy the website.
