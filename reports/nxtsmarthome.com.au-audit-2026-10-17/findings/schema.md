# Schema / Structured Data Findings: nxtsmarthome.com.au

Date: 2026-10-17 | Method: crawl.json (421 HTML pages @200), source review, 19 live pages parsed (home, about, how-we-test, /articles/, category hub, 6 random + 1 named articles, 8 products incl. legacy /product/ URL, /products/, product category, author page, /search/).

## Score: 80 / 100

| Area | Score |
|---|---|
| Validity (0 parse errors, all JSON-LD, https context, absolute URLs, `<` escaped) | 19/20 |
| Article / Person / Org completeness | 15/20 |
| Product / Offer correctness and policy safety | 15/20 |
| Coverage (static pages, listings) | 12/20 |
| Strategy (deprecated/restricted types, SearchAction consistency) | 19/20 |

## What works
- All JSON-LD is server-rendered, valid, `@context` https, absolute URLs, ISO 8601 dates; 0 parse errors across 421 pages (the 6 "no jsonld" URLs are the 404/`/goto` ones).
- Source is centralised in `lib/seo.ts` and rendered via `components/JsonLd.tsx:3-10` (escapes `<` as `<`).
- Organization uses `@id`, a real ImageObject logo (512x512, `lib/seo.ts:22`), areaServed, and WebSite.publisher points to it by `@id`.
- Article `author` is typed correctly: Person for named writers with a profile URL, Organization for the editorial default (`lib/seo.ts:89-97`). Includes headline, image, datePublished, dateModified, mainEntityOfPage, publisher, keywords.
- Article deliberately never emits Review/reviewRating (`lib/seo.ts:68-72`), and Product deliberately emits no aggregateRating/Review because ratings are syndicated from retailers (`lib/seo.ts:172-176`). This matches Google's review policy and the README rule. Live check: zero `aggregateRating`/`Review` strings on sampled product pages. Nothing self-serving found.
- Product offers filtered to verified deep links with price > 0 and excluding search URLs (`lib/seo.ts:181-184`); `priceCurrency: AUD`; AggregateOffer low/high/offerCount are internally consistent on all 8 sampled products.
- BreadcrumbList on 412 pages is correct: sequential positions, absolute `item`, last crumb = current URL, article breadcrumbs match visible nav.
- No HowTo, SpecialAnnouncement, or other deprecated types.
- `/search/` is `noindex, follow` and absent from the sitemap.

## Findings

### 1. [Medium] Offer.url uses affiliate redirects and tracking-param marketplace listings
Evidence: Live Offer URLs include `https://geni.us/thP8`, `geni.us/QKZXO` (aqara-hub-m100, ring-video-doorbell-2nd-gen, govee-smart-light-bulb-b22, smartthings-station) and `ebay.com.au/itm/298484132972?chn=ps&_u...` (sensibo, google-nest-smart-thermostat). Source `lib/seo.ts:210` passes `r.url` straight through.
Impact: Google's structured-data guidelines say Offer data must match the page; the page is a comparison page, not the merchant page, so merchant-listing eligibility is unlikely regardless. The affiliate redirect URLs in markup are crawlable links with no `rel=sponsored` equivalent in JSON-LD.
Fix: Prefer the canonical retailer product URL (or omit `Offer.url`; Google allows omission), strip `chn`/`_u` tracking params.

### 2. [Medium] Price ranges that look like variant/seller mismatches
Evidence: ring-video-doorbell-2nd-gen AggregateOffer 74 to 188 (Amazon URL slug is "Ring-Battery-Doorbell"); google-nest-smart-thermostat 78.90 to 174.99 where the Kogan listing slug is "nexttech-google-nest-…" (third-party/refurb possible); sensibo uses eBay marketplace listing IDs.
Impact: A mismatched variant or used/marketplace listing under a new-product Product risks a "price doesn't match" snippet issue and misleads users.
Fix: Add `itemCondition` (NewCondition/UsedCondition) per Offer where known; exclude eBay item-listing offers from schema or cap the spread to same-SKU offers; verify variant match at import.

### 3. [Low-Medium] No `availability`, `priceValidUntil`, `sku`/`mpn`/`gtin` on Product
Evidence: `lib/seo.ts:181` comment says availability is intentionally omitted (audit #6); no identifiers emitted (live: `sku`/`gtin` absent on all 8 products).
Impact: Required price + priceCurrency are present so product snippets are valid, but missing recommended fields limit rich-result display and Shopping matching. Omitting availability rather than guessing is the correct call; just note the limitation. Product `name` also omits the brand on some pages (e.g. "Grid Connect Smart 4 Outlet Powerboard…" with brand Arlec), whereas Google recommends the full product name.
Fix: Add `mpn`/`gtin13` if the catalogue has them; add `priceValidUntil` only if the price is re-verified on a schedule; use "Brand + model" as `name` in markup.

### 4. [Medium] SearchAction points at a robots-disallowed URL
Evidence: `lib/seo.ts:35-42` emits `/search/?q={search_term_string}` on every page (421); robots.txt has `Disallow: /search/`; the page itself returns `noindex, follow`, which crawlers can't see due to the disallow.
Impact: Self-inconsistent. Google removed the sitelinks search box feature (Nov 2024), so the markup has no rich-result benefit, and it advertises a blocked path. Not harmful but noise on every page.
Fix: Remove `potentialAction` (simplest), or keep it for non-Google consumers and accept the inconsistency. Best-practice resolution for noindex: either drop the robots Disallow (keep noindex) or drop SearchAction. Do not need both signals.

### 5. [Medium] Static info pages have no page-level schema
Evidence: about, contact, how-we-test, affiliate-disclosure, privacy, cookies, terms carry only the site-wide Organization+WebSite graph (crawl `[about]` etc.); no BreadcrumbList either. Live /about/ and /how-we-test/ confirmed.
Fix (E-E-A-T entity signals):
```json
{
  "@context": "https://schema.org",
  "@type": "AboutPage",
  "@id": "https://nxtsmarthome.com.au/about/#webpage",
  "url": "https://nxtsmarthome.com.au/about/",
  "name": "About NXT Smart Home",
  "inLanguage": "en-AU",
  "isPartOf": { "@id": "https://nxtsmarthome.com.au/#website" },
  "about": { "@id": "https://nxtsmarthome.com.au/#organisation" },
  "breadcrumb": { "@type": "BreadcrumbList", "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://nxtsmarthome.com.au/" },
    { "@type": "ListItem", "position": 2, "name": "About", "item": "https://nxtsmarthome.com.au/about/" } ] }
}
```
Use `ContactPage` for /contact/ and plain `WebPage` (with `isPartOf`) for the others. Add a `contactPoint` to Organization (email is already present) if a public support email exists.

### 6. [Low] Organization sameAs and Person depth are thin
Evidence: `lib/site.ts:38-42` has only Facebook set (twitter/youtube empty strings are filtered correctly). Person (`authors/[slug]/page.tsx:60-68`) has name/url/description/jobTitle but no `sameAs`, `image`, `worksFor`, `knowsAbout`.
Fix: add LinkedIn/X/GitHub or Wikidata links for authors; `worksFor: {"@id": ".../#organisation"}`; author `image`. Article embeds author without `@id`, so author is not linked to the profile entity:
```json
"author": { "@type": "Person", "@id": "https://nxtsmarthome.com.au/authors/kritin-curtis/#person", "name": "Kritin Curtis", "url": "https://nxtsmarthome.com.au/authors/kritin-curtis/" }
```
and give the author-page Person the same `@id`.

### 7. [Info] FAQPage on 145 pages (no Google rich result)
Evidence: `faqJsonLd` at `lib/seo.ts:105-115`, used in `[category]/[slug]/page.tsx:146`, `GuidePillar.tsx:84`, `products/page.tsx:153`. Live: 4-5 Q&As, content matches visible FAQ.
Impact: Google retired FAQ rich results for all sites (May 2026); no SERP benefit, any AI/GEO benefit unconfirmed. Not an error and valid. Keep if the visible FAQ stays; no need to prioritise, and don't add to new pages for SERP reasons. If these are genuine user-submitted Q&A use QAPage (they are editorial, so not applicable).

### 8. [Low] Home page `Thing` nodes and CollectionPage
Evidence: home `CollectionPage.about` is an array of bare `{"@type":"Thing","name":...}` (crawl: 'Thing': 2). Valid but low-value; bare Things add no entity information.
Fix: drop `about`, or use `hasPart`/ItemList of category URLs. Home also lacks a standalone `WebPage`/`@id` link to `#website`; `isPartOf` creates a duplicate untyped WebSite (no `@id`) rather than referencing `{"@id": ".../#website"}`. Fix by using the id reference.

### 9. [Low] Product listing and product category pages have no ItemList/CollectionPage
Evidence: /products/ emits Breadcrumb + FAQPage only; `/products/category/lighting/` emits only a BreadcrumbList (inline at `products/category/[slug]/page.tsx:85-97`, which also bypasses the `breadcrumbJsonLd` helper). /articles/ and /categories/* do have CollectionPage+ItemList (with 14 paginated pages; pages 10-14 redirect to /articles/, see technical findings).
Fix: add CollectionPage + ItemList of product URLs (url+name only, no price) for parity.

### 10. [Info] Article `ItemList` of Product (roundups) is a second Product type without offers
`itemListJsonLd` (`lib/seo.ts:118-135`) emits Product items with only name/brand/image inside ItemList on articles. Google's Product carousel rules want `url`/full product data; as-is these are ignorable, and since they lack offers they can trigger "missing offers/review/aggregateRating" non-critical warnings in Rich Results Test if treated as Product snippets. Fix: use `url` pointing to /products/<slug>/ (full Product there) and drop the nested `@type: Product`, or add `url`.

### 11. [Info] security-and-cameras: "16 crawled, 11 Article" is not a schema bug
The 11 real articles all carry Article. The 5 extra URLs are malformed (`.../door-window-sensors-entry-alerts/\"https:/nxtsmarthome.com.au/security/...\"`), all 404 with noindex, so no schema. Root cause is stray escaped quotes in the body of `door-window-sensors-entry-alerts` (broken markdown/link syntax producing hrefs), a content fix. Also `/categories/smart-door-locks/` is flagged noindex/thin in the crawl and has no JSON-LD in some views; verify.

### 12. [Low] Date handling
Article `datePublished` values like `2026-04-16T00:00:00.000Z` and `2026-10-07T21:35:52.002Z` are valid ISO 8601 but offset-less UTC; for an AU site the local date may differ by a day (Z 21:35 = next day in AEDT). Several articles have `dateModified` equal to import timestamps (e.g. 2026-09-24T07:57:52Z across multiple pages), which suggests dateModified tracks bulk updates rather than substantive edits; Google may discount it. Fix: emit `+10:00/+11:00` offsets (Australia/Sydney) and only bump `updated` on real content changes.

## Where schema is generated
| Schema | File:line |
|---|---|
| Organization+WebSite+SearchAction | `lib/seo.ts:10-46`, rendered `app/(frontend)/layout.tsx:146` |
| BreadcrumbList helper | `lib/seo.ts:53-64` |
| Article | `lib/seo.ts:66-103`, used `app/(frontend)/[category]/[slug]/page.tsx:135` |
| FAQPage | `lib/seo.ts:105-115` (`[category]/[slug]/page.tsx:146`, `components/category/GuidePillar.tsx:84`, `products/page.tsx:153`) |
| Article ItemList | `lib/seo.ts:118-135` (`page.tsx:147`) |
| Product/AggregateOffer | `lib/seo.ts:178-217`, used `products/[slug]/page.tsx:122` |
| CollectionPage/ItemList | `components/ArticlesList.tsx:37-44`, `components/category/TopicHub.tsx:81-88`, `all-topics/page.tsx:122-128`, `app/(frontend)/page.tsx:38` |
| Person/Organization author | `app/(frontend)/authors/[slug]/page.tsx:60-68` |

## Priority actions
1. Clean Offer.url (no geni.us/tracking params) and exclude eBay/third-party-variant offers; add itemCondition (#1, #2).
2. Resolve SearchAction vs robots Disallow, preferably remove SearchAction (#4).
3. Add AboutPage/ContactPage/WebPage + breadcrumb to static pages (#5).
4. Link author entity by `@id`, add sameAs/image (#6); fix home `isPartOf` reference (#8).
5. Optional: product listing ItemList, GTIN/MPN, AU-offset dates (#3, #9, #12). FAQPage: leave as Info.
