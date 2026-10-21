# Mobile performance evidence

Measured the compiled standalone Next.js application through the local Nginx/PHP-FPM edge, with Chromium 154 at 390×844, DPR 2, a cold browser cache, 4× CPU slowdown, 150ms latency and 1.6Mbps download / 750Kbps upload. Introduction enabled; no reduced-motion override. These are local laboratory samples, not field Core Web Vitals or a guarantee for all devices.

| Metric | Initial sample | After font subsets |
|---|---:|---:|
| Largest-contentful paint | 5,052ms | 3,984ms |
| Cumulative layout shift | 0.000291 | 0.000291 |
| Resource transfer | 905,790 bytes | 691,155 bytes |
| DOM content loaded | 956ms | 852ms |
| Longest recorded main-thread task | 449ms | 455ms |

The approved fonts retain the same outlines/axes while Latin, currency and UI symbols use smaller WOFF2 subsets; other supported glyphs retain full-font fallback. Introduction motion uses fixed text nodes and transform/opacity animation, with skip/Escape/replay and reduced-motion support. No per-frame text/layout loop is used.

Regression budgets for this exact local profile: LCP ≤4.2s, CLS <0.02 and resource transfer <750KB. A second run using the committed reproduction script measured LCP 3,944ms, the same CLS/transfer total, DOM content loaded 866ms and a longest main-thread task of 518ms. Both final samples meet the LCP/CLS/transfer budgets; long-task variance still needs physical-device investigation. The final samples meet these local budgets; it does not meet the general 2.5-second “good” LCP threshold on this deliberately constrained connection. Re-measure against the real HTTPS/CDN deployment and real catalogue before launch. Long-task and animation behaviour on physical phones still need field qualification.

Reproduce with `CHROMIUM_PATH=/path/to/chromium scripts/pnpm.sh exec node scripts/performance.mjs` while the local release edge is running, or set PERFORMANCE_URL to a permitted test deployment. Keep measurements out of the production customer flow.
