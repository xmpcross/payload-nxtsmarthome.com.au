# Action Plan — nxtsmarthome.com.au (17 Oct 2026)

Health score **68/100**. Fix items in this order. Effort estimates are rough.

## Progress, 18 Oct 2026 (content items only)

Done on 18 Oct; details in `findings/content-2026-10-18.md`. Technical and performance items have not been re-checked and are not marked.

- **C1** done. The random byline was already removed from the writer. Adrian Thompson and Harry Cheng were not real contributors: their 9 posts now carry Kritin Curtis's byline, their author records and pages are deleted, and their URLs 301 to `/authors/kritin-curtis/`.
- **H5** done. 67 legal, safety and tenancy articles now have a `## Sources` section with verified official links. The 4 articles that were not legal topics got hand-picked manufacturer and eSafety sources instead. The writer's legal-source check now flags only one article, a false positive.
- **Medium, content** done:
  - The smart-plug and lighting-scene duplicates were already 301-merged; the 10 merged copies are now unpublished.
  - Hub "Related guides" sections link the smart-plug, automation and lighting-scene clusters.
  - Over-promising titles were rewritten.
  - The non-AU Aqara H1 EU switch was removed from both articles and switched off (its URL 301s to lighting), and the Nest Thermostat's offers were switched off.
  - The kettle line was fixed.
- **Medium, disclosure page** done. The score and rank wording is gone, the page is dated, and Geniuslink is listed. The commission notice sits above the offers on product pages.
- **Low, cadence** done. Publishing now waits at least 24h after the newest release (`--allow-burst` to override). `dateModified` was bumped only on the 10 factually corrected articles.
- **Also done:**
  - Retailer star scores now count Australian reviews only, with a minimum of 20, and are labelled.
  - The ABN and PO box are on `/about/`, `/contact/`, `/terms/` and `/privacy/`.
  - Each AI-drafted article carries a one-line AI note (needs a deploy).
  - Sentences were shortened across the archive.
  - Product-page hedging and weak sources were cleaned up.
- **Open (content):** label AI imagery, and author `sameAs` and credentials (real profiles needed).

## Critical (this week)
| # | Action | Where | Effort |
|---|---|---|---|
| C1 | Stop random author assignment, reconcile author pages and bylines, confirm every named author is a real contributor, and add credentials | `scripts/generate-post.ts` (L94, L400), Payload Authors | 0.5–1 day |
| C2 | Replace or repair the 45 `/goto?url=` affiliate links (they return 404 on ~63 pages) | Payload Offers / `app/public/data/products.json` | 2–4 h |
| C3 | Fix the escaped-quote links in door-window-sensors-entry-alerts, and add a publish validation that rejects `\"` | Payload admin; writer `content-rules.mjs` | 1 h |

## High (within 1 week)
| # | Action | Where | Effort |
|---|---|---|---|
| H1 | Product hero: width, height, aspect-ratio and `fetchPriority="high"` (CLS on 230 URLs) | `app/(frontend)/products/[slug]/page.tsx:157-161` | 30 min |
| H2 | Home LCP image: set `fetchPriority` explicitly and tighten `sizes`. Inline critical CSS. | `components/SectionMagazine10.tsx:23`, `PostFeaturedMedia.tsx:75-82` | 0.5–1 day |
| H3 | Fix horizontal overflow on the mobile guide template (`.single-meta`, carousel) | guide template CSS | 1 h |
| H4 | Shrink the mobile cookie banner to 100px or less | cookie banner component | 1 h |
| H5 | Back-fill a Sources block on unsourced electrical, tenancy and privacy articles (42) | Payload articles | ~25 min/article |
| H6 | Add comparison or picks tables to vs/best/buying guides, starting with the robot vacuum and smart plug guides | Payload articles + template | 1–2 days |
| H7 | Create `/robot-vacuums/best-robot-vacuum-australia/` with picks by budget, pets and floor type | new article | 1 day |

## Medium (within 1 month)
- Normalise 59 internal links to canonical slash URLs. Remove `//` links from `/all-topics/` and the pagination links from `/sitemap/` (`sitemap/page.tsx:96,140`).
- Shorten the title template, remove the duplicate brand, and cap meta descriptions at about 155 characters (221 product pages).
- Add the brand to product H1s and titles, and per-product og:title, og:image and share URLs.
- Make the 404 template output only `noindex`, with no canonical.
- Set `s-maxage` for product pages and `/search/` to 300 seconds plus stale-while-revalidate. Add a Cloudflare Cache Rule for HTML.
- Add width and height to card and list images (`ProductCard.tsx:64`, `ProductBox.tsx:48`, `RelatedProducts.tsx:30`, `RetailerPriceList.tsx:49`).
- Lazy-load non-critical client JavaScript (search, audio, aside, cookie banner).
- Schema: remove SearchAction, use retailer URLs in `Offer.url`, add `itemCondition`, and add page schema and breadcrumbs to static pages.
- Content: consolidate cannibalising smart-plug and lighting-scene articles with 301 redirects, rewrite titles that over-promise, remove non-AU picks, and reconcile the kettle safety advice.
- Disclosure page: remove the "score/verdict" wording and add an update date. Move the commission notice above the offers on product pages.
- Decide on an AI crawler policy and make robots.txt match the Cloudflare firewall. Consider allowing Amazonbot.
- Label or hide the duplicate overlay card links (`aria-label`, or `aria-hidden` with `tabindex=-1`).
- Tap targets of at least 44px. On mobile product pages, show the H1, price and CTA first.

## Low (backlog)
- Build out Organization and author `sameAs`, add `@id` linking, and add off-site profiles (LinkedIn, YouTube).
- Use real `lastmod` dates in the sitemap, and add the missing automation explainer.
- `ads.txt` when AdSense is enabled. HSTS of 1 year with `includeSubDomains`. Remove `x-powered-by`. Add a CSP.
- Regenerate AI hero images without garbled text, and label AI imagery.
- llms.txt (optional). Link `/feed.xml` from the page head.
- Stagger publishing, and only bump `dateModified` on real edits.

## Monitoring
- Add a Google API key (PSI, CrUX, Search Console) and re-run for field Core Web Vitals and ranking data.
- Create a drift baseline: `claude-seo run drift_baseline.py https://nxtsmarthome.com.au`.
