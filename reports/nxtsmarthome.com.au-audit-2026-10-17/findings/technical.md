# Technical SEO audit: nxtsmarthome.com.au (2026-10-17)

Category score: 74/100 (Crawlability 85, Indexability 70, Security 72, URLs 62, Mobile 85, CWV potential 70, Structured data 85, JS rendering 95)

Evidence base: data/crawl.json (427 fetched URLs, followed redirects), live curl checks on 2026-10-17, source in /kspellman/sites/nxtsmarthome.com.au/app.

## What works
- Fully server-rendered (Next.js ISR); `is_spa:false` in data/homepage-render.json; no JS needed for content, links or JSON-LD.
- HTTPS everywhere. http -> https 301 and www -> apex 301 (single hop, path preserved), nginx-snippet line 7.
- Security headers present on all responses: HSTS, X-Content-Type-Options nosniff, X-Frame-Options SAMEORIGIN, Referrer-Policy strict-origin-when-cross-origin, Permissions-Policy.
- Trailing-slash policy is enforced by redirect (308), not by duplicate 200s. Wrong-category article URLs (/hubs-and-platforms/door-window-sensors-entry-alerts/), legacy /climate/, /energy/, /product/ prefixes all 308 to the canonical path (`app/(frontend)/[category]/[slug]/page.tsx:98-105`, `next.config.mjs` redirects, nginx `_redirects.map` 573 rules). Real 404s return a true 404 status with noindex.
- Every 200 page: lang="en-AU", viewport meta, self-referencing absolute canonical, OG image, twitter card, exactly one H1, meta description present. 0 images missing alt. 0 JSON-LD parse errors. No thin pages (<300 words) among indexable URLs.
- Average HTML 279 KB, avg server time 213 ms (crawl), hero images preloaded, next/image with webp.
- robots.txt (served from app/public/robots.txt via nginx alias) is valid, blocks /admin/, /api/, /search/, /preview/, /design-preview/ and declares the sitemap.
- Sitemap: 336 URLs, all absolute, trailing slash, all 200, none noindex, none redirected, no duplicates.

## Corrections to the orchestrator leads
- Lead 1 (no-slash returns 200): FALSE as a live behaviour. `curl -I /lighting/smart-bulbs-vs-smart-switches-australia` returns 308 to the slash form. The crawler followed redirects and recorded the final page. The real issue is that 59 no-slash/double-slash hrefs are still emitted in internal links (see H2).
- Lead 2 (any category prefix returns 200): FALSE. Wrong prefix returns 308 to the canonical URL, as do /climate/, /energy/, /product/. The 308 (not 301) is functionally equivalent for Google.
- Lead 3 (pagination): by design. `app/(frontend)/articles/page/[page]/page.tsx` permanentRedirects to /articles/ because /articles/ is now one page listing all articles (114 links, "Every article" index). The only defect is that /sitemap/ still links to 13 dead pagination URLs (H3).
- Lead 7 numbers confirmed (385/421 titles >60 chars).

## Findings

### Critical
None.

### High

**H1. Affiliate outbound links point to a non-existent /goto endpoint (404).**
- Evidence: 45 entries in `app/public/data/products.json` have `"url": "/goto?url=CAES..."` (Google Shopping tokens, e.g. line 60). They render as `<a href="/goto?url=..." rel="sponsored nofollow noopener noreferrer">` on 63 crawled pages (e.g. /products/amazon-echo-dot-max-speaker/, 2 per page). `curl -I /goto?url=...` -> 308 -> `/goto/?url=...` -> 404. No route or nginx rule exists for /goto (grep of app/, config/, `_redirects.map`: only the data file references it).
- Impact: dead buy buttons on ~63 pages (lost affiliate revenue, poor UX signal, wasted crawl on a 404 linked 63 times). rel is correct (sponsored nofollow); the problem is the target.
- Fix: remove or replace these 45 URLs in the catalogue source (re-import with the real retailer/Geniuslink URL; `lib/geniuslink-links.ts` / `data/geniuslink-links.json` already maps others) and hide the button when no valid URL exists. If the token links must survive, add a route handler `app/(frontend)/goto/route.ts` that decodes and 302s to an allow-listed retailer host, with `X-Robots-Tag: noindex` and `/goto/` in robots.txt Disallow. Add a build guard (like `catalogue-guard.mjs`) that fails on internal hrefs returning 404.
- Secondary: the 404 page for /goto emits both `<meta name="robots" content="noindex">` and `<meta name="robots" content="index, follow">` plus a canonical to the homepage (see M3).

**H2. Corrupted escaped hrefs in article body, producing 5 crawlable 404s and orphaned old-prefix links.**
- Evidence: https://nxtsmarthome.com.au/security-and-cameras/door-window-sensors-entry-alerts/ HTML contains literal `<a href=\"https://nxtsmarthome.com.au/security/stop-parcel-theft-smart-doorbell\">` (backslash-escaped quotes, `/security/` prefix that no longer exists, no trailing slash). Browsers resolve these as relative `\"https:/nxtsmarthome.com.au/security/...\"` URLs: 5 targets (keep-security-cameras-running-blackout-nbn-outage, smart-lock-compatibility-australian-doors, stop-parcel-theft-smart-doorbell, wired-vs-battery-security-cameras-australia, wiring-video-doorbell-australian-chime-transformer) all 404 (crawl status 404, shown with noindex).
- Root cause: the article body stored in the Payload DB contains JSON-escaped quotes (generation artefact). The string is not present in app/content, app/exports or app/drafts (grep), so it lives only in the database `posts` body for this article. No other crawled article has backslash links.
- Fix: edit this article body in Payload admin, replacing each with `<a href="/security-and-cameras/<slug>/">`. Add a publish-time validator in the Payload `beforeChange` hook (or `lib/editorial-guard.mjs`) rejecting `\"` and any internal href not matching `^/[a-z-]+/[a-z0-9-]+/$` or absolute apex URLs without trailing slash. Run a one-off DB scan `body LIKE '%href=\\"%'` for other articles (read-only, by the site owner).

**H3. 59 internal links use non-canonical forms (each costs a 308 hop and dilutes crawl budget), including 12 double-slash links.**
- Evidence (crawl internal_links): 60 distinct non-canonical hrefs: 12 with `//` (all from /all-topics/, e.g. /buying-guides/smart-home-devices-home-office//), ~34 no-slash article links (e.g. /lighting/smart-lighting-scene-ideas, /hubs-and-platforms/switch-smart-home-platforms), 6 legacy /climate/ links, 3 /energy/, 5 /product/, 4 no-slash /products/, 6 pages with `https://nxtsmarthome.com.au` (no slash). 690 link instances total across pages; the same ~10 articles (e.g. students-share-houses, smart-lighting-scene-ideas) are linked from 10 pages each. `//` URLs also return 200 in the crawl after the redirect, canonicalised to the single-slash form.
- Root cause: the article body HTML (DB) and /all-topics/ template concatenate `${base}/${slug}//` or use `/<slug>` without slash; `/sitemap/` page (`app/(frontend)/sitemap/page.tsx:96,140` -> `/articles/page/${n}/`) links the 13 removed pagination URLs.
- Fix: normalise at render time: in the shared link helper (`lib/urls.ts` `articleHref`) and in the HTML post-processor for article bodies, rewrite internal hrefs to `/{category}/{slug}/` (collapse `//`, add trailing slash, map legacy prefixes via `merged-articles`/redirect table). Fix the /all-topics/ template that builds the `//`. Remove the page/N loop from sitemap/page.tsx:96-145. Then crawl to confirm 0 internal 3xx.

### Medium

**M1. 385 of 421 titles exceed 60 characters (91%); 5 titles repeat the brand twice.**
- Examples: "Smart Home Topics & Categories — NXT Smart Home AU | NXT Smart Home"; "Smart Lighting Scene Ideas for Every Room | NXT Smart Home | NXT Smart Home"; "Contact NXT Smart Home | NXT Smart Home"; "Smart Home Devices for Australian Homes | NXT Smart Home | NXT Smart Home". The 14 identical "All Articles ..." titles are the /articles/page/N/ redirect URLs, not real duplicates.
- Fix: root layout `title.template: '%s | NXT Smart Home'` and strip the brand from per-page `title` fields (including CMS `pages` titles and /all-topics/, /contact/). Target 50-60 chars before the suffix; for product pages shorten the generated pattern. Suffix could drop to " | NXT" where long.

**M2. Meta descriptions too long on product pages.** 225/234 product pages (plus 5 /product/ and 3 others) exceed 160 chars; max 499. Google truncates and often rewrites. Fix: cap generated descriptions to ~155 chars at the source (`lib/seo.ts`).

**M3. 404 page conflicting robots/canonical.** Any 404 (e.g. /zzz-random/, /goto/) renders `<meta name="robots" content="noindex">` AND `<meta name="robots" content="index, follow">` AND `<link rel="canonical" href="https://nxtsmarthome.com.au/">`. noindex wins and status is a true 404, so low risk, but the crawler classified /goto as "index,follow, canonical to home". Fix: in `app/(frontend)/not-found.tsx` / root layout metadata, do not emit default robots/canonical when not-found; the root `alternates.canonical` is inherited.

**M4. 5,975 of 8,794 images (68%) lack width/height attributes** (products: 3,089 of 3,584; other pages 2,886 of 5,210). CLS risk (INP/LCP not affected directly). Fix: pass intrinsic width/height (or `fill` inside an aspect-ratio box) in the product card/gallery and article-card components; Payload media records already carry dimensions.

**M5. Linked-but-noindex category /categories/smart-door-locks/.** Returns 200, `noindex, follow`, self canonical, yet is linked from 421 pages (site nav/footer). It is correctly excluded from the sitemap. Fix: either publish content to reach the indexing threshold or remove it from `lib/nav.ts` / `lib/nav-cache.json` so ~421 links do not point at a noindexed page (and users do not hit a thin page).

**M6. Cache-Control on product pages and /search/: `s-maxage=31536000` (1 year).** 225 of 234 product pages and /search/. Prices/availability and the `/goto` fix will not propagate if a CDN honours this; Cloudflare reports DYNAMIC (not cached) today so the effect is latent, and if a cache rule is added it would serve stale. Fix: use `revalidate = 3600-86400` on product pages (as articles use 300 + swr) and align the header.

**M7. ads.txt returns 404** (`app/(frontend)/ads.txt/route.ts` 404s when NEXT_PUBLIC_ADSENSE_CLIENT is unset; AdSense script is also absent from the homepage HTML). Not an SEO defect today; if AdSense is planned, set the env var and verify before ads go live.

### Low

- L1. HSTS `max-age=15768000` (6 months), no `includeSubDomains`/`preload`. Raise to 31536000 + includeSubDomains once all subdomains are HTTPS; the header is set by Cloudflare, not nginx.
- L2. No Content-Security-Policy, no COOP/CORP. Add a report-only CSP first. `x-powered-by: Next.js, Payload` leaks stack (set `poweredByHeader:false`).
- L3. One indexable article is missing from the sitemap: /hubs-and-platforms/smart-home-automation-scenes-routines-sensors-how-they-work/ (self-canonical, 200, 12 internal links point at its `//` form). Ensure it is in `getAllArticles()` output. 4 product pages (aeotec-smart-home-hub-smartthings, amazon-echo-dot-max-speaker, blaupunkt-bptv10-android-tv-streaming-device, tp-link-tapo-p110-smart-plug-with-energy-monitoring) were crawled only in their no-slash form (so not "missing": the slash forms are in the sitemap).
- L4. Homepage 610 KB, /products/ 871 KB and /authors/kritin-curtis/ 817 KB HTML (4 pages >500 KB). Paginate or lazy-load the long lists; preload hints include 3840w srcset candidates, restrict `deviceSizes`.
- L5. /feed.xml present (200 RSS) but no `<link rel="alternate" type="application/rss+xml">` check was made; confirm in head.
- L6. 308 vs 301: Next emits 308 for trailing-slash and permanentRedirect; nginx map emits 301. Both pass signals; no action.

### Info
- Products: 234 crawled = 230 unique indexable pages (+4 no-slash duplicates); the sitemap lists 230. README says 221 indexable at import time; the later catalogue growth explains the +9. Indexing rule is `isIndexableProduct` in `lib/products.ts:282`; non-qualifying products emit `noindex, follow` (`products/[slug]/page.tsx:60`), none observed in the crawl.
- IndexNow: `scripts/submit-indexnow.mjs` exists and key file /982d15ff0cc8a13e34b98d230c838560.txt returns 200 (key location OK). Confirm it is invoked from `deploy.sh` after each build and logs success.
- hreflang: none; single-region en-AU site, acceptable.
- Structured data: Organization/WebSite/SearchAction/BreadcrumbList on all pages, Person on articles; no Article/Product/Review types detected in jsonld_types on /products/* (only the generic set). Defer detailed validation to the schema sub-audit; consider Product + AggregateOffer on indexable product pages and Article/BlogPosting on guides.
- Crawl: 427 fetched, 421 x 200, 6 x 404 (the /goto no-slash plus the 5 corrupted hrefs from H2).
