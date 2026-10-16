# SEO Audit — nxtsmarthome.com.au

**Date:** 17 October 2026 · **Scope:** full site (427 URLs crawled, 336 in sitemap, 84 canonical articles, ~230 product pages)
**Business type:** Affiliate publisher — independent Australian smart-home guides plus a researched (not hands-on tested) product catalogue. Not a local business.

## SEO Health Score: 68 / 100

| Category | Weight | Score | Weighted |
|---|---|---|---|
| Technical SEO | 22% | 76 | 16.7 |
| Content Quality | 23% | 56 | 12.9 |
| On-Page SEO | 20% | 65 | 13.0 |
| Schema / Structured Data | 10% | 80 | 8.0 |
| Performance (CWV) | 10% | 76 | 7.6 |
| AI Search Readiness | 10% | 65 | 6.5 |
| Images | 5% | 60 | 3.0 |
| **Total** | | | **67.7 → 68** |

Technical blends technical (74) and sitemap (82). AI Search Readiness blends GEO (60) and agent readiness (heuristic 90, weighted lightly). The previous content audit (6 Oct 2026) scored Content Quality 64, so it has fallen 8 points since then.

### Data limitations
- No Google API, CrUX, Search Console or GA4 credentials were available. Performance is based on lab data only (local Lighthouse, one run per page), and there is no ranking or traffic data.
- PageSpeed Insights was rate-limited, so the Lighthouse Agentic Browsing fraction is not available.
- No Moz or DataForSEO data was available, so there is no referring-domain list. Common Crawl shows the domain below its ranking threshold.
- **Correction to the first crawl:** the crawler followed redirects without recording them. URLs without a trailing slash, wrong-category paths and legacy paths (`/climate/`, `/energy/`, `/product/`) correctly **308** to the canonical URL; they do not return 200. I re-checked this with curl.

## Executive summary

### Top 5 critical issues
1. **Article bylines are assigned at random.** `scripts/generate-post.ts` picks the author with `Math.random()`, and author bios claim articles that are bylined to someone else. That is a deceptive-authorship and E-E-A-T risk. Confirm that every named author is a real contributor.
2. **About 45 affiliate buy buttons are dead.** On roughly 63 pages they link to `/goto?url=…`, which returns 404.
3. **47 of 84 articles cite no sources.** These include electrical-work, tenancy and privacy topics, which contradicts the promise on `/how-we-test/`.
4. **Mobile Core Web Vitals fail (lab).** LCP is 4.9–6.9s on every tested page, and product pages also fail CLS (0.16–0.19) because the hero image has no dimensions.
5. **Money pages are the wrong page type for their queries.** Searches like "best robot vacuum australia" and "best smart plug australia" return ranked lists of products. The site serves explainers with no picks or comparison tables.

### Top 5 quick wins
1. Fix the 5 broken escaped-quote links in `/security-and-cameras/door-window-sensors-entry-alerts/` in the Payload admin.
2. Add width, height and `fetchPriority="high"` to the product hero (`app/(frontend)/products/[slug]/page.tsx:157-161`). This fixes CLS on 230 URLs.
3. Shrink the mobile cookie banner from 39% of the viewport to a bar of 100px or less.
4. Remove the duplicated brand name from titles and shorten the title suffix (385 of 421 titles are over 60 characters).
5. Normalise internal links: fix 59 links that point at redirects, including 12 `//` links on `/all-topics/`. Also remove the 13 dead `/articles/page/N/` links from `/sitemap/`.

---

## Technical SEO — 76
**What works**
- The site is fully server-rendered.
- http and www redirect to the https apex in one hop.
- Wrong or legacy paths 308 to the canonical URL.
- 404s are real 404s.
- robots.txt is valid.
- The sitemap's 336 URLs all return 200 and are indexable.
- Every page has a canonical, `lang` and exactly one H1.

| Severity | Finding | Fix |
|---|---|---|
| High | 45 `/goto?url=CAES…` buy links in `app/public/data/products.json` (first at line 60) return 404. No route or nginx rule exists for `/goto`. | Replace them in Payload Offers with real retailer URLs, or add a `/goto` route that only redirects to approved retailer hosts. |
| High | `door-window-sensors-entry-alerts` article body contains `\"https:/…\"` links, giving 5 URLs that 404. The text is in the database. | Edit it in the Payload admin, and add a publish-time check that rejects `\"`. |
| Medium | 59 internal links point at redirecting URLs, and `/sitemap/` links 13 pagination URLs that redirect to `/articles/`. | Normalise links in the link helpers and edit `app/(frontend)/sitemap/page.tsx:96,140`. |
| Medium | The 404 template outputs both `noindex` and `index, follow`, plus a canonical to the homepage. | Output only `noindex` and no canonical. |
| Medium | Product pages and `/search/` send `s-maxage=31536000`. | Use 300 seconds plus stale-while-revalidate. |
| Low | Sitemap `lastmod` is partly synthetic (bulk-import timestamps). One indexable article is missing from the sitemap. | Use real modified dates and include all indexable articles. |
| Low | `ads.txt` returns 404, HSTS max-age is 6 months, there is no CSP, and `x-powered-by` is exposed. | Fix these as part of normal hygiene. |

Details: [findings/technical.md](findings/technical.md), [findings/sitemap.md](findings/sitemap.md)

## Content Quality — 56 (E-E-A-T 46)
**What works**
- The trust pages are honest: content is described as research-only, AI drafting is disclosed on `/about/`, and products say "has not tested".
- Articles published since 7 Oct have Sources sections.
- Product pages are not copy-paste.
- The affiliate notice is above the fold on articles.

| Severity | Finding |
|---|---|
| High | Bylines are random, author pages contradict them, and no author shows credentials or `sameAs` links (CQ1). |
| High | 47 of 84 articles are unsourced, including 42 on electrical, privacy or tenancy topics (CQ2). |
| High | Titles over-promise ("Home Battery Rebate 2026", "Real Numbers") (CQ3). |
| Medium | The site shows a scaled-content pattern (18 articles published in 4 minutes, 41 articles sharing one `dateModified`, unlabelled AI hero images) (CQ4). |
| Medium | Non-AU products are recommended, such as the Aqara H1 EU switch. Kettle advice contradicts the site's own safety article (CQ5). |
| Medium | Articles compete for the same searches: 5 smart-plug articles and 3 lighting-scene articles (CQ6). |
| Medium | The affiliate disclosure mentions scores that the site doesn't give and has no update date. 224 meta descriptions are over 160 characters (CQ7, CQ8). |

Details: [findings/content.md](findings/content.md)

## On-Page SEO — 65
**What works**
- Each page has one H1, a unique title and a self-referencing canonical.
- No sitemap URL is orphaned.

| Severity | Finding | Fix |
|---|---|---|
| Medium | 385 of 421 titles are over 60 characters, and some repeat the brand ("…NXT Smart Home AU \| NXT Smart Home"). | Shorten the suffix in the title template. |
| Medium | Product H1s and titles drop the brand ("Hub M100"). | Prefix the brand. |
| Medium | Product pages use the default og:title and `og-default.png`, and their share links point to the homepage. | Output per-product Open Graph tags and share URLs. |
| Low | `/categories/smart-door-locks/` is `noindex` but linked from all 421 pages. | Populate and index it, or remove it from the nav. |

## Schema & Structured Data — 80
**What works**
- There are 0 JSON-LD parse errors.
- Schema is generated in one place (`lib/seo.ts`).
- BreadcrumbList appears on 412 pages.
- There is no self-serving rating markup.
- Offers are AUD-only.

| Severity | Finding |
|---|---|
| Medium | SearchAction appears on every page but targets the robots-disallowed `/search/`. Google has retired the feature, so remove it. |
| Medium | `Offer.url` uses geni.us and tracked eBay redirects, and some price ranges mix variants or sellers. Use retailer product URLs and add `itemCondition`. |
| Medium | Static pages have no page-level schema or breadcrumb. |
| Low | Entity linking is weak: Organization `sameAs` lists only Facebook, Person has no `sameAs`, and Article author has no `@id`. |
| Info | FAQPage markup is on 145 pages and valid, but FAQ rich results were retired in May 2026. Leave it in place, but don't add it for SERP reasons. |

Details: [findings/schema.md](findings/schema.md)

## Performance — 76 (lab, mobile average 72, desktop 97)
| Page (mobile) | LCP | TBT | CLS |
|---|---|---|---|
| Home | 6.5s | 210ms | 0 |
| /articles/ | 5.2s | 164ms | 0 |
| Category | 5.3s | 214ms | 0 |
| Article (Tuya) | 6.0s | 326ms | 0 |
| Article (smart plug) | 6.9s | 222ms | 0 |
| Product (Bluetti) | 5.0s | 320ms | 0.191 |
| Product (Millers Falls) | 4.9s | 242ms | 0.158 |

The main causes are a render-blocking 60KB CSS file, no effective `fetchpriority` on the home LCP image, the unsized product hero, about 560KB of JavaScript across 23 scripts, and HTML that Cloudflare doesn't cache (`cf-cache-status: DYNAMIC`). Details: [findings/performance.md](findings/performance.md)

## Images — 60
- **Missing dimensions:** 5,975 of 8,794 images have no width or height (3,089 of 3,584 product images).
- **Alt text:** no image is missing an `alt` attribute, but 1,852 have an empty one. Check that none of those are meaningful product images.
- **Garbled AI text:** AI hero images show nonsense text (screenshots in `screenshots/`).
- **Product cut-outs:** low-resolution white-background cut-outs show as white boxes on the dark theme.

## AI Search Readiness — 65
**What works**
- Every crawler that drives AI search citations is allowed (OAI-SearchBot, ChatGPT-User, PerplexityBot, Claude-SearchBot and Googlebot).
- Pages are server-rendered.
- The AU-specific information is strong.
- The agent-UX heuristic scores 90/100.

| Severity | Finding |
|---|---|
| High | There are no comparison tables on vs/best pages (only 1 in 15 sampled pages has one). |
| High | The brand and authors have a thin entity footprint. Brand searches return other companies. |
| Medium | Cloudflare blocks GPTBot, ClaudeBot, CCBot, Amazonbot and others with 403s while robots.txt allows everything. Decide on a policy and make robots.txt match. Blocking Amazonbot hurts Alexa answers. |
| Medium | 12 to 22 unnamed overlay links per page get in the way of agents and screen readers. |
| Low | There is no llms.txt and no Markdown delivery. Both are optional. |

Details: [findings/geo.md](findings/geo.md), [findings/agentic.md](findings/agentic.md), [findings/backlinks.md](findings/backlinks.md)

## Search Experience (SXO) — 63
| Query | Page | Match |
|---|---|---|
| best robot vacuum australia | robot-vacuum-buying-guide-australia | **High mismatch.** Results are ranked lists; the site has no best-of page. |
| best smart plug australia | smart-plug-buying-guide-australia | Medium/High mismatch, but competition is weak. |
| matter smart home australia | what-is-matter-smart-home-australia | Aligned. Freshness is the pressure. |
| best smart home platform australia | best-smart-home-platform-australia | Aligned; the biggest opportunity. |
| aqara hub m100 australia | /products/aqara-hub-m100/ | Aligned. No Australian competitor ranks. |

Persona scores: budget buyer 48 (weakest), pet owner 60, renter 63, Home Assistant user 69, homeowner/DIY 73. Details: [findings/sxo.md](findings/sxo.md)

## Visual / Mobile — 68
- **High:** the cookie banner covers 39% of the mobile viewport.
- **High:** buying-guide pages overflow horizontally on mobile (465px of content in a 390px viewport), caused by `.single-meta` and the carousel.
- **Medium:** on the mobile product page, the price and CTA sit about 5,200px down the page.
- **Medium:** tap targets are under 44px.
- **Medium:** the same $37.00 price appears for every retailer of the Aqara M100. Check the price feed.

Details: [findings/visual.md](findings/visual.md), screenshots in `screenshots/`

---
See [ACTION-PLAN.md](ACTION-PLAN.md) for the prioritised fixes. Structured data for the PDF report is in `audit-data.json`. Raw crawl and Lighthouse data are in `data/`.
