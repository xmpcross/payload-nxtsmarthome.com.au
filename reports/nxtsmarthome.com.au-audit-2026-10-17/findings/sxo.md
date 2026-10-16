# Search Experience (SXO) Findings: nxtsmarthome.com.au

Audit date: 2026-10-17. Separate from the SEO Health Score.

## SXO Gap Score: 63 / 100 (Needs work)

| Dimension | Score | Evidence |
|---|---|---|
| Page type | 8/15 | 2 of 6 priority pages are explainers sitting under listicle intent ("best robot vacuum australia", "best smart plug australia"). Homepage is a hub, but its head query returns market-news results. Platform, Matter and product pages are aligned. |
| Content depth | 13/15 | Guides run 2,512-3,868 words, have Australia-specific substance (10 A / 2300 W ratings, RCM/EESS and Energy Safe Victoria links, dock wiring, grey imports) and 4-6 FAQs. |
| UX signals | 9/15 | Good: "The short answer" box, contents list, disclosure, byline and Updated date above the fold. Weak: no picks/comparison table at the top of the buying guides (0 `<table>` in robot, plug and Matter guides). "6 min read" is shown on pages with 3,534-3,868 words. Raw ISO timestamps (`2026-10-16T19:20:36.672Z`) show on the homepage. A Sponsored Amazon block sits above Editor's Choice. Product H1s drop the brand ("Hub M100"). |
| Schema | 10/15 | Article, FAQPage, BreadcrumbList and Person on guides. Product + AggregateOffer on product pages. No ItemList on any "best"/picks content (only on category pages). No Review markup, which is correct for untested products. FAQ rich results are now limited to gov/health sites, so FAQPage has little SERP value. |
| Media | 8/15 | 30-35 images per guide, but mostly retailer/manufacturer packshots and 8 empty-alt decoratives per guide. No original photos, test footage or video. All 221 product pages use the default `og-default.png` and a generic og:title. |
| Authority | 7/15 | One named author (Kritin Curtis) with a bio. Product pages honestly say "NXT Smart Home has not tested this product", yet the main nav says "How We Test", and the rankers lead with "tested and rated" (Tom's Guide, BHG). A brand search for "nxtsmarthome.com.au" returned no pages from the site, only "Nexxt Solutions" / "Connect SmartHome", so there is a brand-entity confusion risk. |
| Freshness | 8/10 | Updated dates in Sept-Oct 2026. Product pages show "Last price update was: 16 Oct 2026". The robot guide title has no year, while every competing SERP title carries "2026"/"2025". |

## What works

- **Honest, Australia-first positioning.** The homepage intro says it explains "which devices suit Australian wiring and plugs, what renters can set up without drilling, which jobs need a licensed electrician". No ranking competitor (Narwal, Roborock, Nestpath, Canberra Times branded content) offers this. Vendor blogs dominate the SERPs, and the search tool flagged most of them as commercially biased. Being an independent site is the differentiator.
- **Answer-first layout on guides.** "The short answer" box, a jump-link contents list, an affiliate "Heads up" disclosure and an Updated date all appear above the fold.
- **Product pages fill a real SERP gap.** For "aqara hub m100 australia" the SERP has no Australian result: it shows a Harvey Norman NZ page plus FR/GR/CZ/CL retailers and USD prices. `/products/aqara-hub-m100/` shows AUD $37.00 across Amazon AU, Officeworks and Bunnings, with a dated price update. That is exactly what the query wants.
- **The platform comparison page matches its intent.** It has "Best for" segmentation for 5 platforms, an "at a glance" table, and FAQs on offline behaviour and subscriptions. The competing SERP is weak (swoop, Bing Lee, an ACCC PDF, a 2016 mailing list).
- **Persona entry points already exist on the homepage.** "Start here: Smart home for beginners / Smart home for renters / Choosing a platform".
- **Deep supporting clusters exist.** Robot vacuums have running costs, dock placement in rentals, Home Assistant local control, stuck fixes and Roborock vs Ecovacs vs Dreame.

## Page-type mismatch summary (lead finding)

| # | Query | Target page | SERP dominant type (confidence) | Target type | Severity |
|---|---|---|---|---|---|
| 1 | best robot vacuum australia | /robot-vacuums/robot-vacuum-buying-guide-australia/ | Comparison/listicle (7/7 legitimate results, 100%) | Blog post / explainer with 2 product cards | **HIGH** |
| 2 | smart plug buying guide australia (and "best smart plug australia") | /energy-and-solar/smart-plug-buying-guide-australia/ | Mixed for "buying guide" (comparison 2, docs 2, product 2, blog 1, forum 1). "best smart plug australia" is 100% listicle (6/6) | Blog post / explainer | **MEDIUM** (HIGH for the "best" variant) |
| 3 | matter smart home australia | /hubs-and-platforms/what-is-matter-smart-home-australia/ | News/blog (9/10 news or tag pages; "what is matter" variant is explainer blog posts from Bosch and Samsung) | Blog post explainer | ALIGNED (freshness pressure) |
| 4 | best smart home platform australia | /hubs-and-platforms/best-smart-home-platform-australia/ | No consensus (blog/retailer guide ~45%). Weak SERP | Comparison | ALIGNED, biggest opportunity |
| 5 | smart home australia | / (homepage) | Market news/statistics (8/9, Telsyte/iTWire/ChannelNews/Statista) | Hub / collection page | MEDIUM (query has poor value; retarget) |
| 6 | aqara hub m100 australia | /products/aqara-hub-m100/ | Product/retailer (~60%) + launch news (~30%). No AU result | Product page (AggregateOffer) | ALIGNED, gap open |

---

## Findings

### SXO-1 [HIGH] Robot vacuum guide is an explainer, but "best robot vacuum australia" wants a ranked listicle
- **Evidence:** All 7 non-spam SERP results are ranked roundups: Canberra Times "9 best robot vacuums", Finder "Best robot vacuums in Australia 2025", Tom's Guide AU "tested and rated", Narwal "Best Robot Vacuums in Australia for 2026" and "Tested and Ranked", and the Roborock AU blog. Their snippets lead with "best overall / best under $500 / best for pets".
- **Evidence:** The target H1 is "Robot Vacuum Buying Guide: What Actually Matters (and What Does Not)". The rendered page has 0 tables, 0 `$` prices in body text, and only 2 "Check price" product blocks (Dreame L10s Ultra, Ecovacs Deebot X2 Omni), both premium. There is no budget pick and no "best for pets" pick. The site has no `/best-robot-vacuum-australia/` URL at all.
- **Secondary:** "robot vacuum buying guide australia" is a mixed SERP (Narwal buying guide, Boss Hunting, techbullion), and the current page is aligned there. Keep it for that query.
- **Fix:**
  1. Create `/robot-vacuums/best-robot-vacuum-australia/` titled "Best Robot Vacuums in Australia (2026): Picks by Budget, Pets and Floor Type". Give it a picks table at the top (Best overall / Best under $500 / Best for pet hair / Best mop combo / Best for Home Assistant), with AUD price range, navigation type, dock type, local-warranty note and retailer CTA. Add ItemList schema.
  2. Add a "Our picks at a glance" block directly under "The short answer" on the buying guide, linking to the new listicle.
  3. Cross-link the existing Roborock vs Ecovacs vs Dreame page.
  4. Fix "6 min read" on a 3,868-word page. It should be about 15-17 min.

### SXO-2 [HIGH] No "best smart plug" page; buying guide lacks a scannable picks matrix
- **Evidence:** "best smart plug australia 2026": Nestpath (x2), Adorama, HGTV, T3 and Mayfair Farms are all listicles. Nestpath is the only AU-specific result, and the search tool flagged its pricing as inconsistent between pages. That is a weak incumbent.
- **Evidence:** The target page has strong pass/fail criteria (10 A rating, double-power-point size, RCM) but 0 tables and no picks summary. It has 29 sponsored links but no comparison grid tying products to the criteria. Plug-specific product pages already exist (Tapo P110, Eve Energy, SwitchBot Mini AU, Hue, WiZ).
- **Fix:**
  1. Add a "Smart plugs that pass both checks" table near the top: model, rating (A/W), width vs double GPO, protocol (Wi-Fi/Matter/Thread/Zigbee), energy monitoring, local control, AUD price, product page link.
  2. Either retitle the page "Best Smart Plugs in Australia (2026) + What to Check Before You Buy", or spin out a dedicated listicle and keep the guide as the criteria explainer.
  3. Add ItemList schema.
  4. Fix "6 min read" on 3,534 words.

### SXO-3 [HIGH] Product pages: brandless H1, generic social meta, and "How We Test" nav vs "not tested" copy
- **Evidence:** The `/products/aqara-hub-m100/` H1 is "Hub M100". The crawl shows brandless H1s across products (e.g. "4K Google TV Dongle", "TV Streamer 4K", "Air Purifier", "Colour A60 E27 Smart Bulb", "Tapo D210 2K Video Doorbell Camera" without "TP-Link"). All 221 product pages use og:title "NXT Smart Home — Australian Smart Home Guides and Buying Advice" and `og-default.png`. The page's tweet/WhatsApp share links point to the homepage, not the product.
- **Evidence:** The main nav includes "How We Test", but product pages state "NXT Smart Home has not tested this product". The SERP rankers lead with "tested", which makes this inconsistency more visible.
- **Fix:**
  1. Make the H1 "{Brand} {Model}", for example "Aqara Hub M100 (HM-G02D)", and add an AU subtitle such as "Price in Australia, compatibility and where to buy".
  2. Generate og:title/og:image per product.
  3. Point share URLs at the product's own URL.
  4. Rename the nav item "How We Research" (or "Research Method") to match the honest research-based claim.
  5. Add a short "Aqara Hub M100 vs M3 vs Hue Bridge" mini-table. The site already has `/hubs-and-platforms/aqara-m3-vs-hue-bridge-vs-smartthings-station/`, which covers the news-led "should I buy" intent in this SERP.

### SXO-4 [MEDIUM] Homepage head query "smart home australia" is market-news intent; homepage UX leaks trust
- **Evidence:** The SERP is Telsyte, iTWire, ParraNews, ChannelNews, Statista and The New Daily (sponsored), all market-size and adoption statistics. No guide or retailer ranks there. The rendered homepage shows raw ISO timestamps (`2026-10-16T19:20:36.672Z`) on cards. A "Sponsored ... Shop Smart Home" Amazon block appears before "Editors Choice". A brand search returned zero site results.
- **Evidence:** "smart home for beginners australia guide" returns Australia Post, LJ Hooker, Bing Lee and Savvy. These are blog/retailer guides, and the site's "Smart Home for Beginners" page is the right type for that query.
- **Fix:**
  1. Do not chase "smart home australia" with the homepage. Make the homepage the brand/navigational hub ("NXT Smart Home: Independent Smart Home Guides for Australia").
  2. Target "smart home for beginners australia" with the beginners guide.
  3. Optionally publish an "Australian smart home statistics 2026" data page to earn links from the news-style SERP.
  4. Format dates as "16 Oct 2026".
  5. Move the Sponsored block below the editorial picks.
  6. Add `sameAs` (Facebook etc.) and a consistent "NXT Smart Home" entity to the Organization schema to separate the brand from "Nexxt".

### SXO-5 [MEDIUM] Matter explainer is aligned but loses to news on freshness and to vendors on simplicity
- **Evidence:** The "matter smart home australia" SERP is ChannelNews (x4), FutureFive and ChannelLife tag pages, iTWire and IMARC, mostly 2022-era. The "what is matter" variant ranks Bosch and Samsung SDS explainers. The target has "The short answer", an FAQ ("Does Matter work the same in Australia as overseas?") and was updated 1 Aug 2026, but it has 0 tables and no AU product availability list.
- **Fix:**
  1. Add a "Matter in Australia: what changed (changelog)" box with dated entries, for example the Matter 1.4/1.5 device types and AU launches such as the Aqara G350.
  2. Add a "Matter devices you can buy at JB Hi-Fi / Bunnings / Officeworks" table linking to product pages.
  3. Add a simple diagram showing Matter vs Thread vs Wi-Fi.
  4. Keep dateModified current.

### SXO-6 [MEDIUM] Budget and pet-owner personas are underserved across the buying guides
- **Evidence:** SERP snippets repeatedly segment by "best under $500" (Canberra Times) and "best for pet hair" (BHG, Home Beautiful, Narwal pet-hair pages). The robot guide mentions "budget" twice, has no price bands, and its picks are premium only. A "Homes with pets" section exists but has no pet pick.
- **Fix:** Add price-band rows (under $300 / $300-800 / $800+) with an AUD range and a "what you give up" line to robot, plug and platform guides. Add a "Best for pets" pick with a tangle-free brush and obstacle-avoidance rationale.

### SXO-7 [LOW] Platform comparison: title misses the head term; no year
- **Evidence:** The title is "Which Smart Home Platform Should You Choose in Australia?" while the query is "best smart home platform australia". The SERP is weak: the top results are an affiliate comparison (Nestpath), a retailer guide (Bing Lee), an ACCC PDF and a 2016 mailing list.
- **Fix:** Retitle to "Best Smart Home Platform in Australia (2026): Apple Home vs Google vs Alexa vs SmartThings vs Home Assistant". Add a quick-pick decision tree ("iPhone household → Apple Home; renter with no hub → Alexa/Google; tinkerer → Home Assistant") above the table.

### SXO-8 [LOW] Missing SERP-feature targeting
- FAQPage markup is present, but FAQ rich results are restricted, so shift effort to snippet-shaped content: 40-55-word definition paragraphs under question H2s and list-formatted "decision rule" sections.
- No ItemList on any picks content, and no Product carousel eligibility from guides.
- No video, so the guides cannot appear in video packs. A 60-90 s "how to check a smart plug's rating" or "LiDAR vs camera" clip would differentiate.

---

## User stories (SERP-derived)

1. **Awareness. Signal: Matter SERP is dominated by news/"what is" explainers.** As an Australian shopper who keeps seeing the Matter logo, I want a plain-English answer to whether it matters for what I buy here, so that I do not waste money on the wrong ecosystem.
2. **Consideration. Signal: "best smart home platform australia" results lean on ecosystem choice (Bing Lee, LJ Hooker: Google/Apple/Amazon).** As an iPhone/Android household, I want a side-by-side of platforms with a "best for" verdict, so that I pick a platform once.
3. **Decision. Signal: "best robot vacuum australia" snippets use "best overall / best under $500".** As a budget-conscious buyer, I want ranked picks with AUD prices by budget, so that I can buy today without reading 3,800 words.
4. **Decision. Signal: pet-hair SERP (BHG, Home Beautiful, Narwal).** As a dog/cat owner, I want one recommended model for shedding pets and the reason, so that I avoid tangled brushes.
5. **Decision. Signal: "aqara hub m100 australia" returns only NZ/EU retailers and USD prices.** As a Home Assistant / Aqara user in Australia, I want the AUD price and which local retailer stocks it, so that I do not import a grey unit.

## Persona scoring (weakest first)

| Persona | SERP evidence | Relevance | Clarity | Trust | Action | Total |
|---|---|---|---|---|---|---|
| Budget buyer | "best under $500" segmentation; Nestpath "$20 Tapo Mini" snippets | 12 | 10 | 16 | 10 | **48** |
| Pet owner (SERP-derived) | BHG / Home Beautiful / Narwal pet-hair roundups | 18 | 14 | 16 | 12 | **60** |
| Renter | Site cluster + homepage "Smart home for renters"; dock-in-rental article | 17 | 13 | 18 | 15 | **63** |
| Tech enthusiast / Home Assistant user | Homey forum (Zigbee plugs in AU), local-control questions | 20 | 15 | 19 | 15 | **69** |
| Homeowner / DIY | iZone/Energy Safe compliance, electrician questions | 20 | 17 | 20 | 16 | **73** |

- **Budget buyer (48):** No AUD prices in guide body text. Robot picks are premium only. Read-time label understates effort. Fix: price-band picks table at the top, a "cheapest that passes" row, and a direct retailer CTA.
- **Pet owner (60):** A "Homes with pets" section exists, but there is no pick or CTA. Fix: a "Best for pet hair" card and an FAQ answer that names a model.
- **Renter (63):** Strong renter articles exist but are not surfaced inside the buying guides. Fix: a "Renter-friendly?" column (no wiring / no drilling / bond-safe) in every picks table, plus a link to the rental dock and rental lighting guides.
- **Home Assistant user (69):** Product cons already mention integration quality (e.g. "Ecovacs integration is cloud-based by default"). Fix: a "Local control / HA integration" column (Local / Cloud / Matter) in picks tables and on product spec blocks.
- **Homeowner / DIY (73):** Electrician vs DIY guidance and RCM/EESS links are strong. Fix: an "Install: DIY / licensed electrician" badge on product cards.

## Limitations
- WebSearch is not a live google.com.au SERP. It is US-based, unranked and without SERP-feature data. PAA, AI Overviews, shopping carousels, ads and local packs could not be observed. Result order and the "top 10" are approximate.
- No Search Console, ranking or traffic data, so it is unknown whether the target pages currently rank. The brand query returned no site results, which may indicate limited indexing or visibility. Verify in GSC.
- Personas and scores are analyst estimates from SERP signals and rendered DOM. No user testing or analytics.
- Rendering used Playwright `--mode always` on 5 pages plus the existing homepage render. Mobile above-the-fold layout was not visually inspected.

## Cross-skill references
- `/seo content`: E-E-A-T, especially the "How We Test" vs "not tested" inconsistency and single-author dependency.
- `/seo schema`: ItemList for picks pages, Organization sameAs, per-product OG.
- `/seo page`: product page H1/OG template fix across 221 URLs.
- Generate a PDF report? Use `/seo google report`.

## Structured findings (audit-data.json, category: Search Experience)
```json
{"category":"Search Experience","score":63,"findings":[
{"id":"SXO-1","severity":"high","title":"Robot vacuum guide is an explainer under listicle intent","url":"/robot-vacuums/robot-vacuum-buying-guide-australia/","query":"best robot vacuum australia","fix":"Create /robot-vacuums/best-robot-vacuum-australia/ picks listicle with ItemList; add picks block under short answer; fix read time"},
{"id":"SXO-2","severity":"high","title":"No best smart plug page; guide lacks picks matrix","url":"/energy-and-solar/smart-plug-buying-guide-australia/","query":"best smart plug australia","fix":"Add pass/fail picks table with AUD prices; retitle or spin out listicle; ItemList"},
{"id":"SXO-3","severity":"high","title":"Product pages: brandless H1, default og:title/og:image on 221 pages, How We Test vs not tested","url":"/products/aqara-hub-m100/","query":"aqara hub m100 australia","fix":"H1 {Brand} {Model}; per-product OG; share URLs; rename nav to How We Research"},
{"id":"SXO-4","severity":"medium","title":"Homepage head query is market-news intent; ISO timestamps; sponsored block above editorial","url":"/","query":"smart home australia","fix":"Retarget homepage to brand/hub; format dates; move sponsored block; Organization sameAs"},
{"id":"SXO-5","severity":"medium","title":"Matter explainer needs AU changelog and availability table","url":"/hubs-and-platforms/what-is-matter-smart-home-australia/","query":"matter smart home australia","fix":"Dated changelog box, AU retailer device table, diagram"},
{"id":"SXO-6","severity":"medium","title":"Budget and pet personas underserved","url":"multiple","fix":"Price-band and best-for-pets picks"},
{"id":"SXO-7","severity":"low","title":"Platform comparison title misses head term and year","url":"/hubs-and-platforms/best-smart-home-platform-australia/","query":"best smart home platform australia","fix":"Retitle with Best + 2026; decision tree above table"},
{"id":"SXO-8","severity":"low","title":"SERP feature targeting gaps (ItemList, video, snippet-shaped answers)","url":"sitewide","fix":"Snippet paragraphs, ItemList, short videos"}]}
```
