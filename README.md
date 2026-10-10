# Lumora — Find your glow

A responsive candle portfolio and storefront built with React, TypeScript, Vite, Three.js, and a Node.js / SQLite backend. Prices are in Indian rupees.

## Features

- A real WebGL candle with pointer parallax, floating motion, and an animated flame.
- Lazy-loaded 3D, capped pixel density, off-screen rendering pause, reduced-motion support, and an SVG fallback.
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

The 12 backend tests use local fixtures, not live payments. They cover price tampering, invalid quantities and delivery data, forged signatures, capture failure, repeated callbacks, signed webhooks, upstream errors, and database persistence. Desktop/mobile browser checks were also run for shopping, checkout UI, payment retries, WebGL fallback, and reduced-motion behavior.

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

The newsletter form is a preview only; it does not send or store email addresses. The 3D renderer is a separate chunk; Vite may report a chunk-size warning for Three.js.

## Main files

- `src/App.tsx`: brand sections, catalog filters, dialogs, and shopping bag.
- `src/products.ts`: shared sample catalog and INR formatting.
- `src/components/CandleScene.tsx`: WebGL model and animation.
- `src/components/CandleArt.tsx`: static 3D product renders and the WebGL fallback.
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

## After Dark design

The approved cinematic direction uses charcoal surfaces, warm amber accents, a ribbed-glass Three.js candle, gold label details, and a dark product stage. The hero responds gently to the pointer; reduced-motion preferences produce a static scene. Rendering pauses offscreen and when the document is hidden. A local image remains visible when WebGL is unavailable.

Product cards reuse static WebP renders of the same model to avoid extra WebGL contexts. `public/images/after-dark-story.webp` is AI-generated illustrative campaign imagery, not a photograph of confirmed inventory. All shapes, packaging, names, and prices are samples until the actual products are supplied.
