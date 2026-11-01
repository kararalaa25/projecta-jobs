# Local frontend performance work

This is a Vite/React application. `next/image` and `next/dynamic` require a Next.js runtime; this change uses native responsive `<picture>` plus React `lazy`/`Suspense` without migrating frameworks. No deployment, SQL migration, or production-data writes were performed.

## Changes

- Hero: AVIF sources, WebP fallbacks and the original JPEG fallback. Desktop sources are 960/1280/1920 pixels wide; portrait sources are 480/768 pixels wide. The portrait crop preserves the existing 61% horizontal focal position. Media-specific AVIF preloads use the same `srcset`/`sizes` as the picture, preventing duplicate hero downloads in supporting browsers. Dimensions, eager loading and high fetch priority reserve the image geometry and prioritize above-the-fold content. The logo stays a tiny, resolution-independent SVG with explicit dimensions.
- Fonts: lossless WOFF-to-WOFF2 conversion for all eight UI weights; existing glyphs, font metrics, licenses and `font-display: swap` are preserved. Preload only the main Arabic regular/bold faces. Existing Sora/Cairo WOFF2 and lazy admin faces already use swap. Original WOFF assets remain available. A small inline document-shell style avoids an unstyled outer canvas; Vite continues to emit the entry styles eagerly and optional styles with their chunks.
- Optional UI: account profile/CV/interview/support forms, authentication/recovery, application/posting forms, matching editor and About/Features content load on demand. Dialog shells and focus/close controls remain mounted while content loads. A local error boundary provides a recovery action if an optional chunk fails.
- Training: intersection-based loading starts 600 pixels before the section reaches the viewport, with a responsive reserved placeholder and a fallback for browsers without IntersectionObserver. The `/training` route retains its own existing lazy entry.
- Layout: job skeletons follow the same responsive grid, reserve aspect ratios and card minimum height, and are replaced by real cards. Image dimensions, existing explicit text line heights and responsive training placeholders limit layout movement. Variable-length listings and published courses can still change document height; these placeholders cannot promise zero layout shift for arbitrary content.

## Verification

- `npm run build`: TypeScript and production build pass. The existing 545 KB PDF viewer advisory remains; that viewer is a separate lazy chunk and was not downloaded in these homepage measurements.
- `npm test`: all 155 tests pass.
- Chromium: 320/390/768/1440 pixel viewports; no horizontal overflow; AVIF source selection and single hero transfer; modal close during a delayed chunk; matching editor and authentication on-demand imports; training loads on approach; training detail dialog; no runtime errors.
- Existing account regression: profile/menu/CV workflows, immediate matching updates, verification review and badge refresh, focus/scroll and seven viewport widths pass with mocked APIs/auth/storage/Realtime.

## Mobile Lighthouse observations

Lighthouse 13.6.0, Chromium, default mobile simulated throttling, fresh browser storage, local gzip static server, identical deterministic 36-job fixture. Three alternating before/after runs were collected; metrics below are medians. APIs are local fixtures and never forward to production. These are lab observations, not PageSpeed Insights production results or field Core Web Vitals.

| Metric | Before | After |
| --- | ---: | ---: |
| Performance score | 90 | 99 |
| LCP | 0.911 s | 0.906 s |
| Total blocking time | 406 ms | 138 ms |
| CLS | 0.00039 | 0.00099 |
| Speed Index | 1.205 s | 1.112 s |
| Total transferred | 659,987 bytes | 481,352 bytes |
| JavaScript transferred | 184,016 bytes | 168,402 bytes |
| Fonts transferred | 294,812 bytes | 224,860 bytes |
| Hero transferred | 133,829 bytes | 42,022 bytes |

Total transfer falls about 27%. LCP stays essentially unchanged; CLS remains very low. Scores ranged 84–100 before and 96–99 after, so the score and blocking-time observations have substantial run-to-run variation. Payload reductions and deferred network requests are the reproducible improvements. Production latency, real Telegram volumes, cache state and actual devices will affect deployed scores.

## Reproduce locally

```sh
npm run build
node scripts/performance/serve.mjs dist 5191
```

In another terminal (Lighthouse is an optional audit tool, not an app dependency):

```sh
CHROME_PATH=/usr/bin/chromium npx lighthouse@13.6.0 http://127.0.0.1:5191 \
  --chrome-flags='--headless --no-sandbox' --only-categories=performance \
  --output=json --output-path=work/lighthouse-mobile.json
node scripts/performance/report.mjs work/lighthouse-mobile.json
```

Run audits sequentially on an otherwise idle machine. To compare revisions, preserve the old `dist` before rebuilding and serve it with the same fixture server on another port. Raw reports from this session are in ignored `work/lighthouse-mobile-{before,after}-{1,2,3}.json`.

Included image/font variants are used directly by normal builds. Regeneration requires Pillow with AVIF/WebP support, fonttools and brotli: `python scripts/assets/optimize.py`. No image service, Next.js dependency or database change is required.
