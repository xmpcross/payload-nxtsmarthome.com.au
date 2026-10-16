# Sitemap audit: https://nxtsmarthome.com.au/sitemap.xml (2026-10-17)

Category score: 82/100

## What works
- Declared in robots.txt (`Sitemap: https://nxtsmarthome.com.au/sitemap.xml`) and the URL resolves 200, `content-type: application/xml`, valid urlset XML.
- 336 URLs (well under the 50,000/50 MB limit); single file, no index needed.
- 336/336 are absolute https apex URLs with trailing slash, no duplicates, none redirected, none noindex, none non-200 (checked against crawl.json), none blocked by robots.txt. Noindex pages (/categories/smart-door-locks/, /search/, 404s) are correctly excluded.
- Composition: 230 products, 83 article URLs across 9 categories (buying-guides 12, setup-guides 11, security-and-cameras 11, hubs-and-platforms 10, climate-and-comfort 8, lighting 8, entertainment-and-audio 8, robot-vacuums 8, energy-and-solar 7), 9 category pages, 3 author pages, 7 CMS pages, home, /articles/, /all-topics/, /sitemap/.
- Pagination (/articles/page/N/) deliberately excluded (`app/(frontend)/sitemap.ts` header comment); products filtered through `getIndexableTopProducts()`; categories require >=1 article, product categories >=3 products.
- Regenerates hourly (`revalidate = 3600`), so new CMS content appears without a rebuild.

## Findings

### Medium
**S1. lastmod is partly synthetic.**
- Evidence: distribution of 336 lastmod dates: 94 on 2026-08-04, 75 on 2026-08-05 (product bulk-import timestamps, differing only in milliseconds, e.g. 2026-08-04T15:25:36.162Z/.163Z/.165Z), 52 on 2026-10-05, 41 on 2026-09-24. Home, /articles/, /all-topics/, /sitemap/, category and author pages all take `newest` (the newest article date, `sitemap.ts` `newest`), so they claim a change whenever any article is published. The 7 CMS pages (about, contact, etc.) all show 2026-10-16T17:17:46Z (`page.updatedAt`, evidently set by a bulk re-save), not a real content edit.
- Impact: Google discounts lastmod when it proves unreliable; for a catalogue with price changes this wastes the one useful signal.
- Fix: use product `updatedAt` only when price/stock/editorial text changes (store a `contentUpdatedAt`); use the newest article date in that category for category pages; for CMS pages use a field updated on content edits, not on every save. Truncate to date or keep full ISO but avoid ms jitter.

### Low
- S2. `changefreq` and `priority` are emitted for all 336 URLs. Google ignores both; harmless, remove to cut file size (~25%) or keep for Bing.
- S3. One indexable article is absent: /hubs-and-platforms/smart-home-automation-scenes-routines-sensors-how-they-work/ (200, self-canonical, 12 internal links). Check why `getAllArticles()` omits it (draft/merged flag?) and add it, or noindex it deliberately.
- S4. Header: `cache-control: public, max-age=0, must-revalidate` is served; `public/_headers` says 3600 but nginx does not read `_headers`. Fine; optional `Last-Modified`/ETag handling by Next is present.
- S5. Sitemap-referenced HTML sitemap (/sitemap/) links to 13 removed pagination URLs (/articles/page/2/ ... /14/) which 308 to /articles/ (`app/(frontend)/sitemap/page.tsx:96,140`). Remove.

### Info
- Fallbacks (/sitemap_index.xml, /sitemap-0.xml) not needed because the declared URL validates.
- Sitemap vs crawl reconciliation: 337 indexable self-canonical 200 URLs in the crawl vs 336 listed (the single gap is S3); 0 sitemap URLs missing from crawl.
- IndexNow key file exists (/982d15ff0cc8a13e34b98d230c838560.txt, 200); `scripts/submit-indexnow.mjs` handles submission. Submit changed URLs from the sitemap diff after each deploy.
- Recommended: submit the sitemap in Google Search Console and Bing Webmaster Tools, and monitor "Submitted URL not selected as canonical" for the 4 non-indexable product duplicates.
