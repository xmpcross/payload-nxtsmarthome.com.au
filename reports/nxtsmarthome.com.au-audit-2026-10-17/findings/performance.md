# Performance / Core Web Vitals: nxtsmarthome.com.au

Date: 2026-10-17. Method: local Lighthouse 13.5.0 (Chrome 148, headless, simulated throttling: mobile = Moto G Power / slow 4G, desktop preset), one run per page/form factor. Raw JSON: data/lh/*.json. PSI API was rate-limited (quota error, no key) and there is no CrUX access, so all numbers are LAB data. TBT is the INP proxy. Single runs are noisy; treat +/-10% as noise.

## Score: 76 / 100
Mobile Lighthouse 64-78 (avg 72), desktop 94-99 (avg 97). Mobile is what Google indexes, and every mobile page fails LCP in the lab. Desktop and server speed are excellent.

## Measured (mobile / desktop)
| Page | Perf | LCP | FCP | TBT (INP proxy) | CLS | TTFB |
|---|---|---|---|---|---|---|
| Home | 72 / 96 | 6.46s / 1.29s | 2.0s / 0.50s | 210ms / 0ms | 0 / 0 | 46ms / 727ms (outlier) |
| /articles/ | 78 / 98 | 5.16s / 1.13s | 1.86s / 0.46s | 164ms / 0 | 0 / 0 | 27 / 24ms |
| /categories/lighting/ | 76 / 99 | 5.27s / 0.91s | 1.70s / 0.44s | 214ms / 0 | 0 / 0 | 21 / 18ms |
| Article: tuya-smart-life-local-control | 69 / 98 | 6.00s / 1.19s | 2.0s / 0.53s | 326ms / 26ms | 0 / 0 | 81 / 117ms |
| Article: how-to-choose-set-up-smart-plug | 70 / 94 | 6.85s / 1.45s | 2.0s / 0.49s | 222ms / 11ms | 0 / 0 | 109 / 100ms |
| Product: bluetti-ac2a | 64 / 99 | 4.96s / 1.02s | 1.85s / 0.45s | 320ms / 2ms | **0.191** / 0 | 18 / 20ms |
| Product: millers-falls 400w | 70 / 99 | 4.94s / 0.99s | 1.85s / 0.44s | 242ms / 0 | **0.158** / 0.022 | 18 / 17ms |

CWV status (lab, mobile): LCP FAIL on all 7 (4.9-6.9s, poor >4.0s); INP proxy NEEDS WORK (TBT 164-326ms; 4 of 7 pages above 200ms); CLS FAIL on both product pages (0.19 and 0.16, >0.1), pass elsewhere. Desktop: all pass (one product page CLS 0.022). Simulated mobile LCP is pessimistic; real 4G/5G Australian users will likely see lower numbers, but field data is needed to confirm.

## What works
- TTFB is excellent: curl 25-40ms warm, Lighthouse 17-117ms. Origin (nginx + Next ISR, x-nextjs-cache: HIT) is fast.
- Zero CLS on home, listings and articles; article hero has explicit width/height + fetchpriority=high (app/(frontend)/[category]/[slug]/page.tsx:191-197).
- Self-hosted fonts via next/font/local with display:swap (app/(frontend)/layout.tsx:21-45); no Google Fonts round trip.
- Images served via /_next/image as WebP with responsive srcset and 1-year cache TTL (next.config.mjs:43-51); lazy loading below the fold is widely applied.
- Third parties are deferred: gtag.js loaded from idle callback in public/js/ga-init.js (components/HeadScripts.tsx:54-59); AdSense is gated behind ADS_ENABLED so it is NOT loading now.
- Desktop passes everywhere (LCP 0.9-1.45s, TBT near 0).

## Findings

### 1. HIGH: Mobile LCP 4.9-6.9s on every page, driven by FCP ~1.7-2.0s from render-blocking CSS
- Evidence: FCP is 1.7-2.0s on mobile with TTFB under 100ms, so the delay is client-side. Render-blocking insight: /_next/static/css/250b91359d007358.css (60 KB, ~770ms simulated) and 1535451b8ab46447.css (1.1 KB, ~470ms); est. savings 550-710ms on mobile (all pages). LCP can never beat FCP.
- Fix: inline critical CSS or enable Next experimental `inlineCss`; split the 60 KB global Tailwind/FlyonUI bundle (check app/globals.css and the FlyonUI import for unused components and `@source` scope); ensure the second tiny CSS file is merged. Target FCP under 1.2s on mobile.

### 2. HIGH: Home mobile LCP image is not priority-hinted and loads slowly (resource load duration 1.41s of 6.46s)
- Evidence: LCP element is the first small card (Video Doorbell guide, top=567px), `lcp-discovery`: fetchpriority=high NOT applied; the image is 29 KB WebP at w=750 for a ~380px-wide slot. components/SectionMagazine10.tsx:19-23 passes `priority={index === 0}` to Card18 -> PostFeaturedMedia -> next/image (components/PostFeaturedMedia/PostFeaturedMedia.tsx:75-82) but the rendered tag shows no fetchpriority/preload hint in Lighthouse. Verify with `curl` that `<link rel=preload as=image>` is emitted in the home HTML head; in Next 16 `priority` is deprecated in favour of `preload`/`fetchPriority="high"`, which may explain it.
- Fix: set `fetchPriority="high"` (and `preload`) explicitly on that image; use `sizes="(max-width:640px) 100vw, 380px"` instead of 100vw/33vw (current srcset picks w=750, 29 KB, larger than needed on a phone, 121 KiB image-delivery savings on desktop home). Also consider whether a text hero at the top (the 567px-offset LCP means ~560px of chrome above it) could be shortened on mobile.

### 3. HIGH: CLS 0.16-0.19 on product pages (mobile), unsized hero image
- Evidence: cls-culprits: "Unsized image element" `img.max-h-[380px]` shifts the product summary div (score 0.191 on bluetti-ac2a, 0.158 on millers-falls; desktop 0.022 on millers-falls). Source: app/(frontend)/products/[slug]/page.tsx:157-161 `<img {...responsiveImg(...)} className="max-h-[380px] w-full object-contain">` has no width/height/aspect-ratio.
- Fix: add width/height (e.g. 640x640 or stored image dimensions) plus `aspect-square`/`aspect-[4/3]` and `fetchPriority="high"`, `loading="eager"` (it is also the LCP element, top=181px, currently no priority hint). Expected: CLS to about 0 and LCP improvement.

### 4. MEDIUM: Missing width/height on images site-wide (5,975 of 8,794 <img> per crawl)
- Evidence: Lighthouse unsized-images fails on product pages and one article (score 0.5); the ProductCatalogue grid does set 64x64 (components/products/ProductCatalogue.tsx:108) but the product hero, RelatedProducts, ProductBox, ProductCard (components/ProductCard.tsx:64, ProductBox.tsx:48, RelatedProducts.tsx:30, RetailerPriceList.tsx:49), and in-article body images from the Payload rich text likely lack them. CLS is 0 on tested articles only because sampled images are in aspect-ratio boxes.
- Fix: make `responsiveImg()` (find under lib/) always emit width/height from the media record or a known aspect; add dimensions to the Payload rich-text image serializer. Product images served from /images/products/ are also uncovered by dimension metadata.

### 5. MEDIUM: Mobile JS cost; TBT 164-326ms (INP proxy near/over 200ms)
- Evidence: ~22-23 script requests, ~560 KB transferred JS on every page (largest app chunk 6626-eb20bedf9bbfc98d.js 78 KB; gtag.js 175 KB). Main-thread work 1.9-4.0s (4.0s home), JS execution 1.0-2.6s. Insights flagged: forced reflow (articles, products), legacy JavaScript (12 KiB), duplicated JS. TBT is worst on the Tuya article (326ms) and bluetti product page (320ms).
- Fix: audit which client components hydrate on content pages (AudioProvider, Aside, SearchModal, CookieBanner, FlyonuiScript are mounted in app/(frontend)/layout.tsx; lazy-load with next/dynamic and load FlyonUI JS only on interaction); set browserslist/swc targets to modern browsers to drop the 12 KiB legacy polyfills; run `ANALYZE=true` bundle analyser. Keep gtag deferred (already done), and when AdSense is enabled load it after idle/consent and reserve ad slot heights to avoid CLS.

### 6. MEDIUM: HTML not edge-cached at Cloudflare
- Evidence: `cf-cache-status: DYNAMIC` on /, with `cache-control: s-maxage=300, stale-while-revalidate=31535700`. Every request reaches the origin. Warm origin responses are fast (about 30ms from Sydney PoP), but I saw cold spikes: product page 375ms, article 270ms, home desktop run 727ms, and the article test reached 1.3s TTFB (art2-desktop/mobile LCP subpart) in Lighthouse.
- Fix: add a Cloudflare Cache Rule ("Cache Everything" for HTML on GET without cookies, respecting origin s-maxage) so s-maxage/SWR actually apply at the edge; consider Cache Reserve/Tiered Cache. Note: if you do, ensure the consent/ads don't vary HTML by cookie.

### 7. LOW: Font payload
- Evidence: a 78 KB woff2 (16c56ad6124cd906-s.p.woff2) is among the largest assets; three families are declared (Inter, Urbanist, Outfit; layout.tsx:21-45), each variable with 100-900 range plus italics for two of them. font-display insight not failing.
- Fix: confirm Outfit/Urbanist italics are really used (drop unused files), subset Urbanist to the logo glyphs, and limit to the weight axis actually used. Only the fonts used above the fold should be preloaded.

### 8. LOW: Cache lifetime for static assets
- Evidence: cache-insight flags 7-47 KiB of assets (home desktop 47 KiB, products 29-36 KiB) with short cache lifetimes (likely third-party: ahrefs analytics, geniuslinkcdn, GTM; not controllable) or /images/products static files lacking `immutable`.
- Fix: serve /images/ and /uploads/ with `Cache-Control: public, max-age=31536000, immutable` in nginx (read-only audit, did not inspect nginx config).

## Third parties observed
analytics.ahrefs.com (cookieless), geniuslinkcdn.com (affiliate links), www.googletagmanager.com (deferred). No AdSense request at present (ADS_ENABLED off).

## Prioritised plan (expected impact)
1. Inline/trim critical CSS (finding 1): biggest mobile FCP+LCP win (about 0.6-0.7s).
2. Fix product hero image: dimensions + fetchpriority (finding 3): CLS to 0, LCP gain on 230 product URLs.
3. Explicit fetchPriority and tighter sizes on home LCP card (finding 2).
4. JS trimming / lazy hydration (finding 5): TBT under 200ms.
5. Cloudflare HTML caching (finding 6) and global image-dimension fix (finding 4).

## Caveats
Lab only, one run per config, simulated throttling; no CrUX/PSI field data (PSI rate-limited). Re-run with an API key to get real 75th percentile INP/LCP before finalising severities. Commands for repeat: `lighthouse URL --preset=desktop|default --only-categories=performance`.

## Structured (audit-data.json, Performance)
{"score":76,"cwv_lab_mobile":{"lcp":"fail","inp_proxy_tbt":"needs_improvement","cls":"fail_on_products"},"cwv_lab_desktop":{"lcp":"pass","inp_proxy_tbt":"pass","cls":"pass"},"findings":[{"id":"perf-1","severity":"high"},{"id":"perf-2","severity":"high"},{"id":"perf-3","severity":"high"},{"id":"perf-4","severity":"medium"},{"id":"perf-5","severity":"medium"},{"id":"perf-6","severity":"medium"},{"id":"perf-7","severity":"low"},{"id":"perf-8","severity":"low"}]}
