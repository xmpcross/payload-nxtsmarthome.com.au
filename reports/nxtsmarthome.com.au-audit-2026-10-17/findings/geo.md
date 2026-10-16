# GEO / AI Search Readiness: nxtsmarthome.com.au

Audit date: 2026-10-17. Method: live robots.txt, llms.txt and RSL checks; user-agent spoof tests against the Cloudflare edge; rendered passage-level analysis of 6 sampled articles (trafilatura `extracted_text`), plus a table-presence check on 10 more articles; schema and entity checks; Common Crawl web graph lookup.

## Scores

**AI Search Readiness (GEO Health) score: 60 / 100**

| Dimension | Weight | Score | Weighted |
|---|---|---|---|
| Citability | 25% | 62 | 15.5 |
| Structural Readability | 20% | 72 | 14.4 |
| Multi-Modal Content | 15% | 40 | 6.0 |
| Authority & Brand Signals | 20% | 38 | 7.6 |
| Technical Accessibility | 20% | 80 | 16.0 |
| **Total** | | | **59.5 (rounded to 60)** |

**Citability score: 62 / 100**

Platform-specific scores (these are estimates):

| Platform | Score | Main driver |
|---|---|---|
| Google AI Overviews | 62 | Googlebot can crawl it, SSR, FAQPage and Article schema, AU-specific angle. Held back by weak entity and E-E-A-T signals and no tables. |
| ChatGPT Search | 55 | OAI-SearchBot and ChatGPT-User are allowed. But ChatGPT relies on the Bing index and brand mentions, and brand presence is close to zero. |
| Perplexity | 60 | PerplexityBot and Perplexity-User are allowed. Fresh dates and gov-source links on newer pages help. No comparison tables and few sourced stats. |
| Bing Copilot | 58 | bingbot is allowed and msvalidate.01 is present (Bing Webmaster Tools is verified). No IndexNow seen, and authority is weak. |

## AI crawler access

robots.txt has only `User-agent: *` with `Allow: /` and Disallow rules for /admin/, /api/, /search/, /preview/, /design-preview/ and /cdn-cgi/. It names no individual bots. Sitemap is declared.

Live edge test on an article URL. Requests used spoofed UAs from a non-bot IP, so verified-bot handling may differ. Blocked responses are Cloudflare `403 text/plain "Your request was blocked."`, 25 bytes, so this looks like a UA-based WAF or custom rule.

| Crawler | What it governs | Result |
|---|---|---|
| OAI-SearchBot | ChatGPT Search citations | 200 Allowed |
| ChatGPT-User | ChatGPT user-triggered fetches | 200 Allowed |
| GPTBot | OpenAI training only | **403 Blocked** (WAF) |
| Claude-SearchBot | Claude search citations | 200 Allowed |
| Claude-User | Claude user-triggered fetches | 200 Allowed |
| ClaudeBot / anthropic-ai | Anthropic training only | **403 Blocked** (WAF) |
| PerplexityBot | Perplexity index and citations | 200 Allowed |
| Perplexity-User | Perplexity user fetches | 200 Allowed |
| Googlebot | Google Search and AI Overviews | 200 Allowed |
| Google-Extended | Robots.txt token only (Gemini/Vertex training and grounding). Not a fetcher. | Not disallowed in robots.txt, so Gemini grounding is allowed |
| bingbot | Bing, Copilot and the ChatGPT Search index | 200 Allowed |
| Applebot | Siri, Spotlight, Safari | 200 Allowed |
| Applebot-Extended | Robots.txt token only (Apple Intelligence training) | Not disallowed |
| DuckAssistBot | DuckDuckGo AI answers | 200 Allowed |
| meta-externalagent | Meta AI | 200 Allowed |
| CCBot | Common Crawl (feeds many LLM datasets) | **403 Blocked** (WAF) |
| Amazonbot | Alexa answers and Amazon AI | **403 Blocked** (WAF) |
| Bytespider | ByteDance training | 403 Blocked |
| cohere-ai | Cohere training | 403 Blocked |

All the crawlers that matter for search citations (OAI-SearchBot, Claude-SearchBot, PerplexityBot, Googlebot, bingbot) are allowed. The blocked ones are training crawlers.

**llms.txt:** missing (/llms.txt, /llms-full.txt and /.well-known/llms.txt all return 404 with an HTML 404 page). This is optional and has low impact.
**RSL 1.0 licensing:** missing (/license.xml and /.well-known/rsl.xml return 404). No RSL link in robots.txt.

## What works

- **Server-side rendered (Next.js and Payload), not a client-side SPA.** `is_spa=false` and the raw fetch has the full article text. The FAQ answers inside `<details>` are in the initial HTML, so crawlers that don't run JavaScript still get everything. Cloudflare responses are fast (20 to 60 ms).
- **The crawlers that drive search citations are all allowed** (OAI-SearchBot, Claude-SearchBot, PerplexityBot, Googlebot, bingbot, Applebot, DuckAssistBot).
- **Schema coverage is broad.** Article, Person author, BreadcrumbList and FAQPage are on 145 pages. Product with AggregateOffer is on 208 to 230 product pages. Organization and WebSite are sitewide. There are 0 JSON-LD parse errors. Articles have `datePublished` and `dateModified`, and a visible "Updated" date.
- **The content is distinctly Australian, which LLMs can't easily get elsewhere.** Examples: fixed-wiring licensing law, Z-Wave AU frequency (921.42 MHz), AS/NZS standards, strata and rental rules, NBN outages, AU retailers. This is a strong angle for "in Australia" queries.
- **Many passages already have good definitions.** Examples: "Matter is an application layer, a shared vocabulary... It is not a radio protocol", "Standby power (sometimes called phantom load...) is the electricity...", and "In every Australian state and territory, fixed electrical wiring work must be carried out by a licensed electrician."
- **Newer articles open with the answer.** door-window-sensors and standby-power answer the question in the first 40 to 60 words.
- **Section lengths are in a citable range.** Most H2 and H3 sections are 60 to 230 words. FAQ answers are 50 to 70 words each and work on their own.
- **Some articles cite primary sources.** The split-system aircon article links energy.gov.au, electricalsafety.qld.gov.au, Daikin, Sensibo and Home Assistant docs. The running-costs article links compare.energy.vic.gov.au.
- **Trust pages exist:** /about/, /how-we-test/, /affiliate-disclosure/. Affiliate links correctly use `rel="sponsored nofollow"`. The robot-vacuum article is honest about method ("taken from the user manuals rather than from testing").

## Findings

### GEO-1: Training crawlers are blocked by the Cloudflare WAF while robots.txt says "allow all" (Medium)
- **Evidence:** GPTBot, ClaudeBot, anthropic-ai, CCBot, Bytespider and cohere-ai get 403 "Your request was blocked." robots.txt has no matching Disallow rules.
- **Impact:** Search citation is not affected, because the search bots get 200. But the stated policy and the actual policy don't match. Blocking CCBot keeps the site out of Common Crawl, which many model training corpora and some retrieval systems use. That lowers long-term "baked-in" brand knowledge for a new site that has almost no entity presence. Opting out of training is a valid business choice, but it should be deliberate and documented.
- **Fix:** Decide the policy. If training opt-out is intended, add explicit `User-agent: GPTBot / ClaudeBot / CCBot / Google-Extended / Applebot-Extended` Disallow groups to robots.txt so it matches the WAF, and consider RSL. If brand reach matters more (recommended for a young affiliate publisher), allow GPTBot, ClaudeBot and CCBot in Cloudflare (AI Crawl Control / Security > Bots / custom WAF rule). Effort: 15 minutes.

### GEO-2: Amazonbot is blocked (Medium, specific to this niche)
- **Evidence:** Amazonbot UA returns 403.
- **Impact:** Amazonbot powers Alexa answers and Amazon's AI shopping and Q&A features. Those surfaces matter a lot for a site about Alexa, Echo and smart-home buying.
- **Fix:** Allow Amazonbot in the Cloudflare rule. Effort: 5 minutes.

### GEO-3: No comparison tables, even on "vs" and "best" pages (High)
- **Evidence:** Sampled articles had 0 `<table>` elements, including roborock-vs-ecovacs-vs-dreame, echo-show-vs-nest-hub, reolink-vs-eufy, aqara-m3-vs-hue-bridge-vs-smartthings-station, zigbee-vs-zwave-vs-thread-vs-wifi, best-smart-light-switches, smart-energy-monitors and robot-vacuum-buying-guide. Only thread-vs-matter-difference has one table. Comparisons are written as prose and product cards.
- **Impact:** AI Overviews, Perplexity and Copilot pull heavily from HTML tables for "X vs Y" and "best X" answers. This is the biggest gap in how easily the content can be extracted.
- **Fix:** Add a real `<table>` near the top of every comparison or best-of page. Rows are products or options. Columns are AU price range, protocol, hub required, local control, subscription, best for. Add a "spec / cost per year" table to the running-costs and standby-power articles. Effort: 1 to 2 days for about 40 pages, and it can be templated in Payload.

### GEO-4: Weak entity and brand graph (High)
- **Evidence:**
  - Organization `sameAs` contains only Facebook. There is no logo-to-brand link to LinkedIn, YouTube, Instagram, X, Pinterest or Reddit, and no Wikidata entry. Wikipedia search returns 0 hits for "nxtsmarthome", and no Wikipedia article links to the domain (exturlusage is empty).
  - Author Person schema has only name, url and description. There is no `sameAs`, `image`, `jobTitle` or `knowsAbout`.
  - All 6 sampled articles are by one author (Kritin Curtis). Two other author pages exist (adrian-thompson, harry-cheng) with about 430 to 450 words each.
  - Common Crawl: the domain is in the crawl but below the ranking threshold (no PageRank or harmonic centrality).
- **Impact:** Brand mentions on YouTube, Reddit and Wikipedia correlate far more with AI citations than backlinks do. Right now there is almost no off-site entity for LLMs to resolve "NXT Smart Home" to.
- **Fix:**
  - Create real profiles (YouTube channel, LinkedIn page, Reddit account, Pinterest) and add them to Organization `sameAs`.
  - Enrich Person schema with `sameAs` (LinkedIn), `image`, `jobTitle` and `knowsAbout` (Matter, Zigbee, Home Assistant, AU electrical rules). Add a visible credentials line.
  - Join r/homeassistant, r/AusRenovation, r/australia and r/smarthome threads with useful, non-spammy answers.
  - Create a Wikidata item once there are third-party references.
- **Effort:** schema changes take 1 hour. Off-site presence is ongoing.

### GEO-5: Few statistics with named sources, and inconsistent outbound citations (Medium)
- **Evidence:** what-is-matter has 0 percentages, 0 dollar figures and 0 source attributions. The geni.us links on it are affiliate links, not references. smart-home-electrical-work-australia-legal has 0 outbound links, yet it makes legal claims that need state regulator citations. standby-power has 0 figures for an energy-cost topic. By contrast, split-system aircon ("20% to 50% of the energy used", linked to energy.gov.au) and running-costs ("~0.1kWh", tariff maths) are good models.
- **Fix:**
  - Add 2 to 4 sourced numbers per article, phrased as "According to [Energy Rating / AEMO / ACCC / state regulator], X".
  - Link state electrical-safety regulators on the legal page.
  - Link the CSA Matter spec page on the Matter explainer.
  - Add a short "Sources" list at the end of each article.
- **Effort:** about 20 to 30 minutes per article. Prioritise the top 20 by traffic.

### GEO-6: Older articles open with narrative instead of the answer (Medium)
- **Evidence:**
  - what-is-matter opens with "If you have shopped for smart home gear in the last couple of years..." and doesn't define Matter until the second H2.
  - smart-home-electrical-work opens with a US/UK framing paragraph. The rule appears only under "The rule, plainly".
  - robot-vacuum-running-costs opens with a sticker-price anecdote.
  - The newer template (door-window-sensors, standby-power) already leads with a direct answer of 40 to 60 words.
- **Fix:** Add a 40 to 60 word "Short answer" paragraph straight after the H1 on the older articles (Jan to Sep 2026 cohort). Rename some H2s as questions, for example "What is Matter?", "Can I install a smart switch myself in Australia?", "How much does a robot vacuum cost to run per year?". Question headings currently appear mostly in the FAQ blocks. Effort: about 10 minutes per article.

### GEO-7: One visible FAQ has no FAQPage schema, and that page has broken escaped links (Low)
- **Evidence:** /security-and-cameras/door-window-sensors-entry-alerts/ (and its duplicate path under /hubs-and-platforms/) has a visible "Frequently Asked Questions" section with 6 Q&As but no FAQPage JSON-LD. The crawl also found 5 x 404 URLs built from escaped `\"https:/nxtsmarthome.com.au/security/...\"` hrefs on this page. These are malformed internal links in the CMS rich text.
- **Fix:** Add FAQPage schema to match the template. Fix the escaped hrefs in Payload. Note that Google limits FAQ rich results to authoritative gov and health sites, but the Q&A markup still helps other engines parse the content. Effort: 15 minutes.

### GEO-8: Little multi-modal content (Medium)
- **Evidence:** About 30 `<img>` per article, mostly product-card images. No `<video>` or embedded YouTube. No original diagrams or photos seen in the sample. No tables (see GEO-3).
- **Impact:** YouTube mentions have the strongest observed correlation with AI citations (about 0.74). Multimodal answers in AI Overviews and Copilot like explanatory images and video.
- **Fix:**
  - Make short YouTube explainers for the top 10 evergreen topics (Matter vs Thread, smart switch neutral wire, IR aircon controllers) and embed them with VideoObject schema.
  - Add labelled diagrams, for example a Thread border-router topology and a no-neutral wiring explainer, with descriptive alt text and captions.
- **Effort:** diagrams take 1 to 2 days. Video is ongoing.

### GEO-9: No llms.txt or RSL (Low)
- **Evidence:** All return 404.
- **Fix:** Optional. Publish /llms.txt with a site summary, the top 30 guides grouped by hub, and links to /how-we-test/ and /affiliate-disclosure/. Effort: 30 minutes. Low expected impact, since no major engine has confirmed using it.

### GEO-10: Duplicate article URLs across category paths (Low for GEO; owned by technical SEO)
- **Evidence:** Articles resolve under several paths (/climate/... to /climate-and-comfort/..., cross-category /hubs-and-platforms/door-window-sensors-entry-alerts/, trailing `//`). Most redirect or canonicalise correctly. The cross-category duplicates should be checked.
- **Impact on GEO:** Duplicate URLs split citation signals.
- **Fix:** Make sure every article has one URL and that cross-category paths 301 to it.

### GEO-11: The RSS feed exists but isn't advertised (Low)
- **Evidence:** /feed.xml returns 200, but there's no `<link rel="alternate" type="application/rss+xml">` in `<head>`. No IndexNow key was found.
- **Fix:** Add the alternate link. Turn on IndexNow (Cloudflare Crawler Hints or a Payload hook) so Bing and Copilot (and so ChatGPT Search) pick up updates quickly. Effort: 30 minutes.

## Passage-level citability sample

| Article | Clean words | Answer-first intro | Definitional sentence | Sourced stats | Tables | FAQ (SSR) |
|---|---|---|---|---|---|---|
| what-is-matter-smart-home-australia | 1,399 | No (narrative) | Yes ("Matter is an application layer...") | None | 0 | 4, plus schema |
| make-split-system-aircon-smart-australia | 2,466 | Partial | Yes | Yes (energy.gov.au) | 0 | 6, plus schema |
| robot-vacuum-running-costs-australia | 1,942 | No (anecdote) | Partial | Some ($ and kWh maths) | 0 | 5, plus schema |
| door-window-sensors-entry-alerts | 2,647 | Yes (57 words) | Yes | None | 0 | 6, **no schema** |
| standby-power-costs-appliances-australia | 1,862 | Yes (56 words) | Yes | None | 0 | 6, plus schema |
| smart-home-electrical-work-australia-legal | 894 | No | Yes (strong rule statement) | None, 0 outbound links | 0 | 4, plus schema |

Section sizes are mostly 60 to 230 words, which is good. A few sections run to 530 to 840 words and should be split with H3s: "How to Find Out What's Really Costing You" (840), "The All-in-One Docks Cost More to Feed" (598), "Choosing the Right Sensor Kit" (597).

## Top 5 highest-impact changes

1. **Add HTML comparison tables to every vs/best/buying-guide page** (GEO-3). Impact: high. Effort: 1 to 2 days, templated.
2. **Build the entity graph** (GEO-4): Organization and Person `sameAs`, richer author schema, YouTube, LinkedIn and Reddit presence. Impact: high. Effort: 1 hour for schema, then ongoing.
3. **Add sourced statistics and a "Sources" block to each guide**, starting with the legal and Matter explainers (GEO-5). Impact: medium-high. Effort: about 25 minutes per article.
4. **Add an answer-first "Short answer" paragraph and question-style H2s to the older articles** (GEO-6). Impact: medium. Effort: about 10 minutes per article.
5. **Bring the AI-bot policy in line**: allow Amazonbot, decide on GPTBot, ClaudeBot and CCBot, and make robots.txt match the WAF (GEO-1, GEO-2). Impact: medium. Effort: 15 minutes.

## Brand mention analysis

| Platform | Status |
|---|---|
| Wikipedia | No entity, and no Wikipedia article links to the domain |
| Wikidata | No item for "NXT Smart Home" |
| Reddit | Not verified: the Reddit API refused the unauthenticated request. The only Reddit link on the site is a share-intent button, not a community presence. Treat as absent. |
| YouTube | No channel in `sameAs` and no embeds in the sampled articles. Treat as absent. |
| LinkedIn | Not in `sameAs`. No author LinkedIn links. |
| Facebook | facebook.com/nxtsmarthome/ (the only `sameAs`) |
| Common Crawl web graph | In crawl, but below the ranking threshold (cc-main-2026-jan-feb-mar) |

## Structured data for audit-data.json (AI Search Readiness)

```json
{
  "category": "AI Search Readiness",
  "score": 60,
  "citability_score": 62,
  "dimensions": {"citability": 62, "structural_readability": 72, "multimodal": 40, "authority_brand": 38, "technical_accessibility": 80},
  "platform_scores": {"google_aio": 62, "chatgpt": 55, "perplexity": 60, "bing_copilot": 58},
  "llms_txt": "missing",
  "rsl": "missing",
  "ai_crawlers": {"OAI-SearchBot": "allowed", "ChatGPT-User": "allowed", "GPTBot": "blocked_waf", "Claude-SearchBot": "allowed", "Claude-User": "allowed", "ClaudeBot": "blocked_waf", "PerplexityBot": "allowed", "Perplexity-User": "allowed", "Googlebot": "allowed", "Google-Extended": "not_disallowed", "bingbot": "allowed", "Applebot": "allowed", "Applebot-Extended": "not_disallowed", "CCBot": "blocked_waf", "Amazonbot": "blocked_waf", "Bytespider": "blocked_waf", "cohere-ai": "blocked_waf", "meta-externalagent": "allowed", "DuckAssistBot": "allowed"},
  "findings": [
    {"id": "GEO-1", "severity": "medium", "title": "Training crawlers WAF-blocked while robots.txt allows all"},
    {"id": "GEO-2", "severity": "medium", "title": "Amazonbot (Alexa) blocked"},
    {"id": "GEO-3", "severity": "high", "title": "No comparison tables on vs/best pages"},
    {"id": "GEO-4", "severity": "high", "title": "Weak entity graph: sameAs Facebook only, thin Person schema, no Wikipedia/Wikidata"},
    {"id": "GEO-5", "severity": "medium", "title": "Few source-attributed statistics; legal page has zero outbound citations"},
    {"id": "GEO-6", "severity": "medium", "title": "Older articles not answer-first"},
    {"id": "GEO-7", "severity": "low", "title": "Visible FAQ lacks FAQPage schema; escaped-href 404s on door-window-sensors"},
    {"id": "GEO-8", "severity": "medium", "title": "Little multi-modal content (no video, diagrams or tables)"},
    {"id": "GEO-9", "severity": "low", "title": "No llms.txt / RSL"},
    {"id": "GEO-10", "severity": "low", "title": "Cross-category duplicate article URLs"},
    {"id": "GEO-11", "severity": "low", "title": "RSS not advertised; no IndexNow"}
  ]
}
```
