# Content Quality: nxtsmarthome.com.au

Audit date: 17 October 2026. This was a read-only audit; nothing on the site, in the CMS or in the scripts was changed.

**Evidence base**
- **Live pages fetched** (`render_page.py --mode never`, at about 1 request per second):
  - all 84 canonical articles (83 in the sitemap, plus `/hubs-and-platforms/smart-home-automation-scenes-routines-sensors-how-they-work/`, which is live but not in the sitemap)
  - 10 randomly sampled product pages
  - the home page, `/about/`, `/how-we-test/`, `/affiliate-disclosure/` and `/contact/`
  - all 3 `/authors/*` pages and 2 category pages
- **Crawl data:** `data/crawl.json` (427 URLs) was used for metadata.
- **Writer pipeline read:** `scripts/generate-post.ts` and `scripts/content-rules.mjs`.
- **Baseline:** the 6 October 2026 audit (`/opt/projects/nxtsmarthome.com.au/reports/nxtsmarthome.com.au-audit/findings/content.md`, score 64).
- **Article count:** there are 84 live canonical articles, not ~97. The crawl's extra article-like URLs are duplicates served under legacy or wrong-category paths (`/climate/…`, `/energy/…`, `/hubs-and-platforms/<other-category-slug>/`, double-slash variants). They all canonicalise to the 84.

---

## Content Quality score: 56 / 100 (6 Oct: 64)

| Component | Score | Notes |
|---|---|---|
| E-E-A-T (internal weighted model) | **46** | |
|   Experience (20%) | 30 | Honestly declared as research-only. There is no first-hand testing, and none is claimed. |
|   Expertise (25%) | 55 | Strong AU technical specifics in the older, hand-edited pieces. Recent batches are generic. Authors show no credentials. |
|   Authoritativeness (25%) | 40 | No `sameAs`, `jobTitle` or credentials. 47 of 84 articles cite nothing. |
|   Trustworthiness (30%) | 55 | The trust pages are excellent, but author attribution contradicts itself and the trust pages over-promise sourcing. |
| AI citation readiness | **64** | |
| Readability | 60 | Median heuristic sentence length 24.7 words, Flesch about 46. Post-7 Oct articles are 14–22 words. |
| AU localisation and accuracy | 82 | Strong overall. Non-AU products (EU switch, US thermostat) are still monetised. |
| Thin / duplicate content | 70 | No copy-duplicates. Intent clusters and 230 compiled product pages carry scaled-content risk. |
| Metadata | 50 | 224 meta descriptions over 160 characters (221 of them product pages, median 328). |

**Why the score dropped from 64:**
- The site is no longer single-author, but the multi-author byline is now **assigned at random by the writer script**, and the author pages contradict the bylines.
- About half the article base has **no outbound sourcing at all**, which `/how-we-test/` promises.
- 230 machine-compiled product pages were added.

**What improved since 6 October** (it offsets some of the drop):
- The homepage star ratings and prices are gone.
- The visible date is now an AU-format "Published 16 October 2026".
- The writer's new guardrails show up in its post-7 Oct output: sources section, gov links, shorter sentences, no testing claims.

---

## What works

- **The trust pages are unusually candid.**
  - `/how-we-test/` says: "We have not run hands-on tests of the products we write about, and we do not present our guides as if we had."
  - `/about/` discloses AI drafting: "Some articles are drafted with the help of AI writing tools…"
  - Every product page says "NXT Smart Home has not tested this product."
  - This is exactly the transparency the QRG rewards.
- **No fabricated experience.** The 84 articles were scanned for "we tested / in our testing / hands-on / we measured". The only hits are honest negations ("isn't something we've tested hands-on", `/security-and-cameras/reolink-vs-eufy-security-cameras/`) or unrelated uses ("hands-on cleans").
- **The homepage C1 breach is fixed.** No ★ ratings or hardcoded prices remain on `/`.
- **The writer pipeline has real guardrails.** `content-rules.mjs`:
  - blocks testing claims, scores, hype phrases, US spelling, invented URLs (`unlinkUnsourced`, `verifyLiveUrls`), "or checked by an electrician" and law stated as settled
  - requires a `## Sources` section and an official source on legal topics
  - runs a near-duplicate title check (`nearDuplicateOf`)
  - drops EU/US/UK product variants (`isNonAuVariant`)
  - Articles that fail are saved as drafts.
- **The post-7 Oct generator output shows the guardrails working:**
  - The smart-plug setup guide links erac.gov.au, consumer.vic.gov.au and OAIC, with 10 editorial outbound links and a Sources list.
  - Sentence length is 14–22 words, against 25–32 in the 6 Oct batch.
- **The best older articles are genuinely useful and AU-specific.**
  - `/climate-and-comfort/smart-zoning-ducted-air-conditioning-cost-australia/` attributes its cost ranges to TradieVerify (15 outbound links).
  - `/robot-vacuums/robot-vacuum-running-costs-australia/` quotes dated prices from Roborock's AU store ("at the time of writing Roborock's official Australian store listed a three-pack of dust bags at $39.90") and links ACCC consumer-guarantee guidance.
  - `/buying-guides/smart-home-for-renters-australia/` has 8 government links.
- **Product pages are not copy-paste templates.**
  - Across the 10-page sample, only 3–7% of 8-word shingles are shared across 60% or more of the pages.
  - Each page has "Australian notes" that are often frank. The Google Nest page says: "Google does not officially sell or distribute the Nest Thermostat in Australia… there is no official manufacturer warranty in Australia."
- **Affiliate disclosure is placed above the fold on articles.** "Heads up: when you buy through links on this page we may earn a commission…" sits above the body on every article sampled. Affiliate links carry `rel="sponsored"`.
- **Metadata templating risk is low.** `metadata_template.py` over 338 canonical pairs gave `site_risk: low`, `templated_ratio: 0.0` and `shared_cta_phrases: {}`. There were 6 secondary `description-echoes-title` flags and 12 `brand-suffix-in-description` flags.

---

## Findings

### CQ1. High: author bylines are randomly assigned by the writer script, and the author pages contradict the bylines
**Evidence**
- **Random assignment in code.** `scripts/generate-post.ts` lines 94 and 386–400:
  ```ts
  const AUTHOR_SLUGS = ['adrian-thompson', 'k-curtis', 'harry-cheng'];
  …
  return authorIds[Math.floor(Math.random() * authorIds.length)];
  ```
  (`k-curtis` does not match the live slug `kritin-curtis`, so the pool may silently be only Adrian and Harry.)
- **One batch, three authors, 175 ms.** Three articles were stamped within 175 ms on 7 Oct, each with a different author:
  - `/setup-guides/how-to-choose-and-set-up-your-first-smart-bulb-australia/`: Adrian Thompson, 10:24:14.861Z
  - `/setup-guides/how-to-choose-set-up-smart-plug-australia/`: Harry Cheng, 10:24:14.960Z
  - `/setup-guides/how-to-set-up-smart-home-hub-home-assistant-step-by-step/`: Kritin Curtis, 10:24:15.036Z
- **Adrian Thompson's bio claims articles bylined to Kritin Curtis.** `/authors/adrian-thompson/` says he "has written more than 15 guides… They include Smart Light Switches Without a Neutral Wire…; Thread vs Matter…; Standby Power…; and Smart Home Hubs in Australia…". All four are bylined **Kritin Curtis** in the Article schema and on the page. The page itself lists "2 articles", while `/about/` says "1 article".
- **Harry Cheng's bio does the same.** `/authors/harry-cheng/` claims "more than 20 guides", naming the Robot Vacuum Buying Guide, the split-system article, the HA energy dashboard and the gas ducted/hydronic thermostat article. All four are bylined **Kritin Curtis**. His page lists "1 article".
- **Kritin Curtis's own count is wrong.** `/authors/kritin-curtis/` says "more than 20 guides" next to an "81 articles" count.
- **The about page's promise doesn't hold.** `/about/` says AI-drafted articles are "published under the name of the contributor responsible for them". Random assignment means the named person is not necessarily the one responsible.
- **No credentials anywhere.** None of the three author pages shows qualifications, trade or IT background, external profiles, or `sameAs` / `jobTitle` / `knowsAbout` in Person schema.

**Why it matters:** the QRG asks raters to check who is responsible for content and whether the reputation claims hold up. A byline that the site's own author pages contradict is a direct trust failure. If Adrian Thompson or Harry Cheng are not real people who actually wrote or reviewed the pages bylined to them, this crosses into deceptive authorship, the QRG's lowest-quality territory. I could not verify either way. **Confirm with the owner whether both are real contributors.**

**Fixes**
- Remove random selection. Assign the byline to the person who actually edits and fact-checks the draft, passed explicitly (`--author <slug>`). Fail the run if it is missing.
- Fix the slug list (`k-curtis` → `kritin-curtis`).
- Rewrite the three bios so they list only articles actually bylined to that person. Better, generate the list and count from the CMS rather than prose.
- Add verifiable credentials and `sameAs` (LinkedIn etc.) to each Person entity. If a contributor is a pen name, either drop it or say so plainly.
- Consider a visible "Edited by Kritin Curtis" line on AI-drafted articles. That matches the `/about/` statement that Kritin is the editor responsible for what the site publishes.

### CQ2. High: 47 of 84 articles cite nothing, contradicting `/how-we-test/`
**Evidence**
- **47 articles have zero editorial (non-affiliate) outbound links**, and only **5 of 84** have a Sources section. All 5 date from 7–16 Oct, after the new rules.
- **42 articles mention electrical, privacy, tenancy or strata matters but link no `.gov.au` or regulator page.** Examples:
  - `/setup-guides/smart-home-electrical-work-australia-legal/` has **zero outbound links**. It still uses the heading "The rule, plainly", which the 6 Oct audit called out, and states law as settled: "In every Australian state and territory, fixed electrical wiring work must be carried out by a licensed electrician. There is no general homeowner exemption…"
  - `/security-and-cameras/smart-home-privacy-cameras-australia-law/` has no OAIC or state surveillance-Act links.
  - Also `/security-and-cameras/smart-lock-compatibility-australian-doors/`, `/lighting/best-smart-light-switches-australia/` and `/security-and-cameras/diy-vs-monitored-alarm-systems-australia/`.
- **The whole 6 Oct batch of 14 is unsourced.** These were published at 18:42Z and 22:52Z, 7 per minute-stamp. Every one has 0 outbound links. Examples:
  - `/climate-and-comfort/best-smart-fans-australia/`
  - `/buying-guides/smart-home-devices-home-office/`
  - `/hubs-and-platforms/switch-smart-home-platforms/`
- **The trust page promises more than the content delivers.** `/how-we-test/` says: "For electrical, privacy and tenancy matters we point to the relevant Australian standard, regulator or official guidance." For about half the archive that is not true.

**Fix:** retro-apply `checkNxtsmarthomeContent()` to the 84 live articles and work through the list:
1. Legal and safety articles first (electrical-legal, privacy-law, light-switch, smart-lock, alarms, renters).
2. Add a `## Sources` section with the state regulator (e.g. energysafe.vic.gov.au, Fair Trading NSW), OAIC and ACCC links.
3. Replace "The rule, plainly" and other settled-law phrasing with "According to [regulator]…".

### CQ3. High: low-specificity, generic AI pages, where titles promise data the body declines to give
**Evidence**
- **`/energy-and-solar/home-battery-rebate-smart-home-ready/`**, titled "Home Battery Rebate 2026":
  - It never names the federal Cheaper Home Batteries Program or any state scheme.
  - It explicitly refuses figures: "this article won't quote specific dollar figures or percentages".
  - It has zero outbound links.
  - For a YMYL-adjacent financial topic, this is the QRG's "generic phrasing, lack of specificity" pattern.
- **`/robot-vacuums/robot-vacuum-running-costs-australia/`**, titled "…Real Numbers", concludes: "There is no reliable single five-year figure."
- **`/buying-guides/smart-home-devices-under-50-australia/`** opens with device *categories*, not products under $50: "Rather than chasing an exact price point, it's more useful to think about categories…". It has 0 outbound links and an average sentence length of 34 words.
- **`/climate-and-comfort/best-smart-fans-australia/`** ("Best Smart Fans… Summer 2026") concedes "Genuinely 'smart' standalone fans are still a small category" and pivots to Dyson fan-purifiers and AC controllers.
- **Leftover hype phrasing** in older articles (now blocked for new ones): "unlock" in 8 articles, "peace of mind" in 2, and "elevate", "seamless" and "game-changer" in 1 each.

**Fixes**
- Rewrite the battery-rebate article with the named federal programme and state top-ups, linking DCCEEW / energy.gov.au and state pages, with a dated "as at" figure.
- Retitle "Real Numbers" (or add a worked example with dated AU prices).
- Make "under $50" and "best fans" actual shortlists of named, AU-stocked products. Otherwise retitle them as explainers.
- Generally: an article whose research notes can't support the title's promise should be retitled or held, not published as hedged filler.

### CQ4. Medium–High: scaled-content pattern (publishing cadence, 230 compiled product pages, AI imagery)
**Evidence**
- **Publishing clusters** (Article `datePublished`):
  - 18 articles on 23 Aug between 00:41:36 and 00:45:30Z (about 13 s apart)
  - 14 articles on 6 Oct in two minute-stamps (18:42Z × 7, 22:52Z × 7)
  - 3 articles on 7 Oct within 175 ms
  - **41 of 84** articles carry `dateModified` 2026-09-24
- **230 product pages** were added since the last audit. Each is compiled from manufacturer and retailer data by AI ("Research-based: compiled from the manufacturer's information…").
  - They include internal repetition: "About this product" restates the later description, and the spec table appears twice ("Highlights" plus the full spec list).
  - Formulaic hedging: "per the brand / the brand says / according to" appears 17 times on `/products/homey-bridge-the-ultimate-home-automation-hub/` and 11 on `/products/google-nest-smart-thermostat/`.
  - Thin-data products fall back to boilerplate, e.g. `/products/aqara-smart-light-switch-h1-eu-no-neutral/`: "…is a smart lighting product for Australian homes, listed in the Lighting range for buyers comparing practical smart-home options in Australia. The specification data highlights…"
- **AI-generated images styled as editorial photos.** Hero and section images are fal.ai FLUX output prompted as "Editorial photograph… photorealistic. Shot on a 50mm lens" (`generate-post.ts` lines 489–502). They are unlabelled; alt text is just the article title.
- **Mitigation:** the product pages do carry unique AU notes, honest caveats and per-page sources. Body overlap is low, so this is a risk, not a demonstrated violation. The QRG judges scaled AI content by value added, not by method.

**Fixes**
- Publish articles at a human editorial cadence and only bump `dateModified` for substantive edits.
- **Product pages:**
  - Collapse the duplicated description and spec blocks.
  - Cap the "per the brand" hedging (one attribution line per section).
  - `noindex` products that only have the fallback template paragraph, until they have real AU notes.
- Label generated imagery ("Illustration") or swap in real product or manufacturer imagery.

### CQ5. Medium: non-AU products monetised, and a safety contradiction across articles
**Evidence**
- **Aqara H1 EU switch (flagged 6 Oct, still live).** The "Aqara Smart Light Switch H1 **EU** (No Neutral)" is still placed in `/lighting/best-smart-light-switches-australia/` and `/lighting/smart-lighting-scene-ideas/`. Its own product page says it "is shaped for square or round European backboxes. It will not mount onto standard plaster C-clips or stud brackets…", yet its template paragraph calls it "a smart lighting product for Australian homes".
- **Google Nest Thermostat.** `/products/google-nest-smart-thermostat/` carries affiliate offers even though its own notes say it is not sold in AU, has no AU warranty, and is designed for "North American 20–30V AC low-voltage HVAC systems".
- **Kettle contradiction.** `/hubs-and-platforms/smart-home-automation-scenes-routines-sensors-how-they-work/` (published 16 Oct) suggests "Turn on the kettle, wait five minutes, then announce 'Breakfast is ready'". The site's own `/energy-and-solar/what-not-to-plug-into-a-smart-plug-australia/` lists "Kettles, toasters and portable cooktops… There is also very little reason to automate them."
- **Foreign price.** `/products/homey-bridge-the-ultimate-home-automation-hub/` quotes the Premium subscription at "€2.99 per month" on an AU site.

**Fixes**
- Remove the EU switch from both articles and `noindex` or drop the product. The writer already filters it via `isNonAuVariant`, but existing content was never cleaned.
- Remove affiliate offers from products the site itself says are not sold or supported in AU, or `noindex` them.
- Add a cross-article safety check (unattended heating loads) to `content-rules.mjs`, and edit the kettle line.
- Show AUD pricing, or "price not published in AUD".

### CQ6. Medium: keyword and intent overlap clusters (mostly not copy-duplicates)
TF-IDF body cosine tops out at 0.50. Shared product boxes inflate it, and 5-gram Jaccard within clusters is at most 0.09, so these are intent overlaps rather than duplicate text.

| Cluster | URLs | Action |
|---|---|---|
| Choosing a smart plug | `/setup-guides/how-to-choose-set-up-smart-plug-australia/` (7 Oct, "How to **Choose** and Set Up…") vs `/energy-and-solar/smart-plug-buying-guide-australia/` ("What to Check"). Adjacent: `/energy-and-solar/smart-plugs-energy-monitors-lower-power-bill-australia/`, `/energy-and-solar/what-not-to-plug-into-a-smart-plug-australia/`, `/energy-and-solar/standby-power-costs-appliances-australia/` | Re-scope the 7 Oct article to setup only ("How to set up a smart plug"), and make the buying guide own "choose". Cross-link all five. |
| Robot vacuum guide | `/robot-vacuums/robot-vacuum-buying-guide-australian-homes-pets` returns **200 with identical content** (3,868 words) and canonicalises to `/robot-vacuums/robot-vacuum-buying-guide-australia/` | 301 the duplicate URL instead of relying on canonical. Also the 8 robot-vacuum articles reuse the same Ecovacs/Dreame boxes (cosine 0.40–0.50 between stick-vs-robot, self-emptying, brand comparison); vary the product boxes per intent. |
| Automation basics | New `/hubs-and-platforms/smart-home-automation-scenes-routines-sensors-how-they-work/` (16 Oct, not in sitemap) vs `/setup-guides/smart-home-automation-routines-beginners/` vs `/lighting/smart-lighting-scene-ideas/` | Merge the new explainer into the beginners' routines guide, or make it the hub and link down. Add it to the sitemap if kept. |
| Lighting scenes | `/lighting/circadian-smart-lighting-sleep/`, `/lighting/smart-lighting-kids-rooms/`, `/lighting/smart-lighting-scene-ideas/` (pairwise 0.44–0.50, the highest on site) | Differentiate the intros and product boxes, and cross-link. |
| Cameras | `/security-and-cameras/reolink-vs-eufy-security-cameras/` vs `/security-and-cameras/wired-vs-battery-security-cameras-australia/` (0.48) | Distinct intents. Keep, cross-link. |
| Hubs | `/hubs-and-platforms/aqara-m3-vs-hue-bridge-vs-smartthings-station/` vs `/hubs-and-platforms/samsung-smartthings-australia/` (0.46) | Keep; make the comparison link to the SmartThings deep-dive. |

Previously flagged clusters (camera storage, movie lighting, ducted zoning) appear resolved: the losing URLs are no longer live. Legacy-path duplicates (`/climate/…`, `/energy/…`, `/product/…`, `/hubs-and-platforms/<other-cat>/…`) all return 200 with a canonical. A 301 is cleaner; this is a technical finding for the technical specialist.

### CQ7. Medium: the affiliate disclosure contradicts the no-scores policy, and price freshness is stale
**Evidence**
- **References to scores and rankings the site says it doesn't give.** `/affiliate-disclosure/` says commission does not influence "The score or verdict we give a product" or "the order we rank them in". `/how-we-test/` says "you will not find star ratings or scores from us anywhere on this site."
- **An undated "last updated" line.** `/affiliate-disclosure/`: "Last updated: this page reflects the programmes active on the site right now."
- **Pricing language disagrees across pages.**
  - `/affiliate-disclosure/`: "we do not have a live price feed".
  - `/how-we-test/`: "Product pages show prices… with the date they were last checked."
  - The sampled product pages show "Last Updated 4 August 2026" (about 10 weeks old) under titles reading "… Price in Australia".
- **Disclosure placement on product pages.** The commission notice comes after the retailer offer block, about 80% of the way down the main content. On articles it is correctly placed above the fold.

**Fixes**
- Remove "score or verdict" and "rank" wording (use "which products we include or what we say about them").
- Put a real date on the disclosure.
- Show a "price checked <date>" next to each offer, and refresh or hide offers older than about 30 days.
- Move the product-page disclosure directly above the first retailer button.

### CQ8. Medium: meta descriptions are over-length on product pages (224 pages over 160 characters)
**Evidence** (338 canonical 200 pages)
- **224 descriptions exceed 160 characters:** 221 product pages, plus `/` (205), `/about/` (171) and `/all-topics/` (186).
- **Product descriptions** have a median of **328** characters and a maximum of 499. They are assembled as `"<Product name>: <bestFor sentence>. <first description sentence>."`, e.g. `/products/arlec-grid-connect-smart-4-outlet-powerboard-with-usb-a-and-c-charger/` (402 characters).
  - The name prefix echoes the title on every page. The heuristic only flagged 6 pages as `description-echoes-title` because the remainder is unique.
- **`metadata_template.py`** gave `site_risk: low`, `templated_ratio: 0.0`, with no shared CTA phrases. Secondary flags: 12 × `brand-suffix-in-description`, 6 × `description-echoes-title`.
- **Doubled brand in titles:** "| NXT Smart Home | NXT Smart Home" on `/products/` and `/lighting/smart-lighting-scene-ideas/`.

**Fixes**
- Product description = bestFor sentence only, trimmed to 120–155 characters, without the product-name prefix.
- Hand-write the three static ones.
- Fix the double brand suffix. Product titles also mostly exceed 60 characters ("… Price in Australia | NXT Smart Home"); consider dropping " | NXT Smart Home" on products.

### CQ9. Medium: readability is uneven, the 6 Oct batch is dense, and the newest explainer over-uses question H2s
**Evidence** (heuristic, over extracted text; list items inflate sentence length)

| Group | Average sentence length (words) | Flesch reading ease |
|---|---|---|
| Whole archive (median) | 24.7 | about 46 |
| 6 Oct batch of 14 | 24.5–31.9 | 35–49 |
| Post-7 Oct generator output | 14.3–22.5 | |
| Early-2026 articles | 13–20 | 50–66 |

- `/buying-guides/smart-home-devices-home-office/` averages 31.9 words per sentence.
- **Question H2s:** 58 of 84 articles have no question-form H2. At the other extreme, the 16 Oct explainer has 15 of its 17 H2s as questions, which reads like scraped "People also ask" output.

**Fixes**
- Re-run the 6 Oct batch through the sentence-length rule.
- Aim for a mix: question H2s where they read naturally, at most around half.

### CQ10. Low: homepage filler from the theme remains (C9 from 6 Oct is not fixed)
- The "Editors Choice" heading still has no apostrophe and sits over "Recent Posts".
- The "Daily Newsletter: Get All The Top Stories From Blogs To Keep Track." copy remains.
- "Trending News" and "Popular Posts" are recency lists, not measured popularity.
- 8 `href="#"` links remain (the dead social icons).
- No ABN/ACN or business address is shown for FXN Holdings Limited on `/about/` or `/contact/`. Adding them is a cheap trust signal for an affiliate publisher.

### CQ11. Low: product-page sourcing quality
- **Weak or off-market sources:**
  - `/products/homey-bridge-the-ultimate-home-automation-hub/` lists an unrelated Reddit thread (`reddit.com/r/synology/…home_assistant_on_synology`), a US B&H listing for the **US** model, and an NZ retailer.
  - The Aqara EU page cites a Czech retailer PDF and a Finnish blog.
  - Other pages lean on `manuals.plus`.
- **Product H1s are scraped retailer strings**, e.g. `/products/homey-bridge-the-ultimate-home-automation-hub/` H1 "Bridge The ultimate home automation hub".
- **Fixes:**
  - Restrict product research sources to manufacturer AU pages, AU retailers and AU regulators. Reject `reddit.com`, `manuals.plus` and non-AU retailers in the product pipeline, the same way `content-rules.mjs` does for articles.
  - Normalise the H1 to "Brand Model".

### CQ12. Info: there is no per-article AI disclosure
AI drafting is disclosed only on `/about/`. That is acceptable under the QRG, which judges output quality, not method. Once CQ1 is fixed, a one-line "Drafted with AI tools and edited by <name>" note on each article would make the disclosure consistent with the byline.

---

## AI citation readiness: 64 / 100 (6 Oct: 72)

**Strengths**
- Article, BreadcrumbList and Person JSON-LD on all articles, and FAQPage on 145 URLs.
- An answer-first opening paragraph on all post-7 Oct articles. For example, the smart-plug guide opens: "To choose and set up your first smart plug in Australia, select an RCM-certified 10A plug…"
- Dated, attributed AU figures in the best articles.
- Comparison tables and "Our shortlist" sections in new buying guides.

**Weaknesses**
- 47 articles with no outbound citations; LLMs prefer passages they can corroborate.
- The author entity is not corroborated and is internally contradictory (CQ1), and Person schema has no `sameAs`.
- Hedged non-answers ("won't quote specific dollar figures") give nothing quotable.
- Intent clusters split citation signals.
- The newest article is missing from the sitemap.

---

## Priority order

1. **CQ1:** stop random byline assignment, fix the author bios and counts, and confirm the contributors are real.
2. **CQ2:** retro-source the 42 legal and safety articles and the 6 Oct batch. Run `checkNxtsmarthomeContent()` across live content.
3. **CQ3 and CQ5:**
   - Rewrite or retitle the battery-rebate, "Real Numbers", under-$50 and best-fans articles.
   - Remove the Aqara EU switch and the Nest thermostat offers.
   - Fix the kettle line.
4. **CQ4:**
   - Slow the release cadence.
   - Clean up product-page duplication and hedging.
   - `noindex` fallback-template products.
   - Label AI images.
5. **CQ7 and CQ8:** fix the disclosure wording, price dates and placement, and trim product meta descriptions to 155 characters.
6. **CQ6, CQ9, CQ10, CQ11:** resolve clusters, readability, homepage filler and product sources.

---

## Structured findings (for audit-data.json, category "Content Quality")

```json
{
  "category": "Content Quality",
  "score": 56,
  "eeat": {"experience": 30, "expertise": 55, "authoritativeness": 40, "trustworthiness": 55, "weighted": 46},
  "ai_citation_readiness": 64,
  "metadata_template": {"site_risk": "low", "templated_ratio": 0.0, "shared_cta_phrases": {}, "md_over_160": 224},
  "findings": [
    {"id": "CQ1", "severity": "High", "title": "Random author byline assignment; author bios claim articles bylined to another author", "urls": ["/authors/adrian-thompson/", "/authors/harry-cheng/", "/authors/kritin-curtis/"], "evidence": "generate-post.ts L94, L400 Math.random(); 3 articles at 10:24:14.861-15.036Z on 7 Oct with 3 different authors"},
    {"id": "CQ2", "severity": "High", "title": "47/84 articles have no outbound sources; 42 legal/safety-topic articles link no official source", "urls": ["/setup-guides/smart-home-electrical-work-australia-legal/", "/security-and-cameras/smart-home-privacy-cameras-australia-law/"]},
    {"id": "CQ3", "severity": "High", "title": "Generic low-specificity AI articles; titles promise data the body declines", "urls": ["/energy-and-solar/home-battery-rebate-smart-home-ready/", "/robot-vacuums/robot-vacuum-running-costs-australia/", "/buying-guides/smart-home-devices-under-50-australia/", "/climate-and-comfort/best-smart-fans-australia/"]},
    {"id": "CQ4", "severity": "Medium", "title": "Scaled-content pattern: bulk publish stamps, 230 compiled product pages with internal repetition, unlabelled AI imagery"},
    {"id": "CQ5", "severity": "Medium", "title": "Non-AU products monetised (Aqara H1 EU, Nest Thermostat); kettle automation contradicts own safety article; EUR pricing"},
    {"id": "CQ6", "severity": "Medium", "title": "Intent overlap clusters (smart plug x5, automation basics, lighting scenes, robot-vacuum duplicate URL 200)"},
    {"id": "CQ7", "severity": "Medium", "title": "Affiliate disclosure references scores/rankings; undated; product price dates ~10 weeks old; product disclosure below offers"},
    {"id": "CQ8", "severity": "Medium", "title": "224 meta descriptions >160 chars (221 products, median 328); double brand suffix in titles"},
    {"id": "CQ9", "severity": "Medium", "title": "6 Oct batch dense (ASL 24.5-31.9); 58/84 no question H2s; newest explainer 15/17 question H2s"},
    {"id": "CQ10", "severity": "Low", "title": "Homepage theme filler, dead # links, no ABN/address"},
    {"id": "CQ11", "severity": "Low", "title": "Product sources include Reddit, manuals.plus, US/NZ/EU retailers; scraped product H1s"},
    {"id": "CQ12", "severity": "Info", "title": "AI disclosure only on /about/"}
  ]
}
```
