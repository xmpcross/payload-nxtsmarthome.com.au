# Product prices and offers (Payload-native)

`prices.ts` checks retailer prices for catalogue products and proposes changes to the
Payload **Offers** and **Products** collections. It replaces the file-based
`scripts/refresh-prices.mjs`, which wrote `public/data/products.json`. That script is
kept for reference only.

**It works review-first.** Every command prints a change report and saves it as JSON
and Markdown under `app/scratch/price-runs/`, a gitignored folder. Nothing is saved to
Payload unless you pass `--write`.

Run it through the wrapper, which uses `app/node_modules/.bin/tsx` and loads
`app/.env.local`:

```bash
cd /kspellman/sites/nxtsmarthome.com.au
scripts/prices.sh <command> [options]
```

## Commands

### `search "<query>" [--limit 10] [--max-cost 1]`

This command only produces a report and never writes anything. It runs a Google
Shopping search through DataForSEO (`merchant/google/products`), then calls
`product_info` for the top `--limit` candidates. For each candidate it reports:

- title and brand (from the `Brand` spec, otherwise the first word of the title)
- AU price range and AU offer count, counting only recognised AU retailers whose URL
  host is on the allow-list. Grey-market sellers are excluded.
- `googleProductId` and GTIN
- whether the product is already in the catalogue. Matching tries the
  `googleProductId` first, then the normalised brand and name, then the brand plus the
  model number.

```bash
scripts/prices.sh search "aqara hub" --limit 5
```

### Scope: `--inactive` and `--all`

`refresh`, `link` and `zenrows` consider **active** products by default. `--inactive`
selects only products with `active = false` (for example the Amazon AU imports), and
`--all` selects both. `--product <slug>` picks one product whatever its scope. These
flags only choose products: no command ever changes a product's `active` flag.

### `refresh [--inactive|--all] [--product slug] [--limit N] [--write] [--drop-stale] [--max-cost 1]`

Calls DataForSEO `product_info` for each product in scope that has a `googleProductId`.
Products whose prices were checked least recently go first, so `--limit` (or a cron
job) works through the whole catalogue over successive runs. For each AU retailer it
finds:

| Situation | Plan entry | Written with `--write` |
|---|---|---|
| Price differs from the offer | `UPDATE` | `priceAud`, plus a direct URL if the offer only had a search URL |
| Price unchanged | `CHECKED` | `sourceData.checkedAt` only |
| Retailer has no offer yet | `ADD` | new offer: `deepLink: true`, `active: true`, `primary: false`, ordered after the existing offers |
| Change of more than ×1.5 either way, or a new retailer more than ×1.5 from the product's median offer price | `HOLD` | nothing; review it by hand |
| An offer the result did not include, last checked more than 14 days ago | `STALE` | nothing; with `--drop-stale` its `priceAud` is cleared (the offer stays active) |
| Excluded seller, URL host not on the allow-list, no price, no Merchant record, inactive offer | `skip` | nothing |

Offers are never deleted or deactivated, inactive offers are never reactivated, and
Merchants are never created. A retailer with no Merchant record (for example Costco
AU) is reported and skipped.

If the product has a GTIN (in `sourceData.gtin`, its specifications or the Amazon
`productInformation`) and the Google product states a different one, nothing is planned
for that product and the report says to check its `googleProductId`.

On `--write`, each checked product gets `sourceData.pricesCheckedAt`, which the
"Last price update" line reads. Its `priceAud` is then recalculated from the offers
now in the database, as the lowest active offer price.

```bash
scripts/prices.sh refresh --limit 20                     # review
scripts/prices.sh refresh --product aqara-hub-m100       # one product
scripts/prices.sh refresh --limit 20 --write             # apply
scripts/prices.sh refresh --write --drop-stale --max-cost 0.5
```

### `link [--inactive|--all] [--product slug] [--limit N] [--write] [--max-cost 1]`

Finds the Google Shopping product id for products in scope that have **no**
`googleProductId`, so that `refresh` can then look up their other AU retailers. It posts
one DataForSEO Google Shopping search per product (`merchant/google/products`, AU
location 2036, English, depth 40 = one billed SERP), up to 100 tasks per `task_post`.

The query is the brand plus the product's distinctive model tokens (`lib/match.ts`
`distinctiveModelTokens`: model-number-like tokens without spec tokens such as `2k`,
`1080p`, `5ghz`, `ip65`). When the name has none, the model number from the
specifications (`Item model number`, `Model`, …) is used; failing that, brand + name.
A brand such as "eufy Security" is searched and matched as "eufy" too.

Each result is checked with `identityMatch` (an identical GTIN, or the brand plus every
distinctive model token with no variant/accessory word the product lacks):

| Outcome | When | Written with `--write` |
|---|---|---|
| `matched` (`high`/`medium`) | every matching result is the same Google product id. Short model tokens (under 3 characters) also need 60% of the name's other words in the title; `medium` = short token or lower name coverage | `googleProductId`, and `sourceData.googleLink = {matchedAt, title, reason, query, confidence, by}` merged into the existing `sourceData` |
| `ambiguous` | several different Google products match; a short-token match without the rest of the name; the id is already linked to another product; or two products in the run claim the same id | nothing |
| `no match` | no result matches, the product has no model number and no GTIN, or the matching listing has no Google product id | nothing |

The report lists up to five candidates per product with the reason each was rejected.
No other product field is sent, and a product that gained an id in the meantime is left
alone. Before posting, the command prints a cost estimate (see Budgets).

```bash
scripts/prices.sh link --inactive --limit 3                 # review 3
scripts/prices.sh link --inactive --write --max-cost 0.5     # link all unlinked inactive products
scripts/prices.sh refresh --inactive --write --max-cost 0.5  # then add their other AU retailers
```

### `zenrows [--inactive|--all] [--product slug] [--retailer name] [--verify|--fill] [--limit 10] [--write] [--max-requests 50]`

Fetches retailer pages through ZenRows (AU premium proxy). Six retailers are supported:
Amazon AU, JB Hi-Fi, Harvey Norman, The Good Guys, eBay AU and Bunnings.

- **`--verify`** (the default) loads each active offer's own page and reads its price.
  A matching price is marked `VERIFIED`. A different price becomes an `UPDATE`, or a
  `HOLD` if the change is beyond ×1.5.
- **`--fill`** covers supported retailers that have no offer for the product. It
  searches the retailer and proposes an `ADD` only when a result matches on **brand
  plus model number**, or when the product page's GTIN matches the product's GTIN.
  Every other result is listed under "Gap-fill candidates" and is never written. A
  product whose name has no model number (no token mixing letters and digits) can
  only be matched by GTIN. Spec-like tokens ("2nd", "4k", "128gb") do not count as a
  model number, and listings with condition words ("faulty", "issues", "see
  description", "open box"…) never match.
  A retailer whose only offer is a search-results page (`/s?k=`, `/search`, `?q=`…)
  counts as missing: a match replaces the search URL with the product URL (`UPDATE
  … (+ direct URL)`). `--search-only` limits `--fill` to those offers, so no requests
  are spent on retailers with no offer. Amazon results are read from its result cards
  (brand + title, clean `/dp/<ASIN>` URL).
- JB Hi-Fi search results load after the page renders, so its search is fetched with
  a 6 s render wait (`searchWaitMs`) and read from the result cards only (header
  promos also link to `/products/`).
- **Known gaps (22 Oct 2026):** The Good Guys search comes back without results even
  with a render wait, so `--fill` finds nothing there; Scorptec, Bing Lee, Mwave,
  Officeworks and Kogan are not supported.

Prices are extracted in this order:

1. JSON-LD `Product`/`Offer` (including `AggregateOffer.lowPrice`)
2. `product:price:amount`, `og:price:amount` or `itemprop="price"`
3. selectors specific to each retailer

A price stated in a currency other than AUD is rejected. It is never converted.

```bash
scripts/prices.sh zenrows --product smartmi-air-purifier-c1
scripts/prices.sh zenrows --retailer "JB Hi-Fi" --fill --limit 5
scripts/prices.sh zenrows --verify --fill --limit 10 --max-requests 40 --write
```

### `report`

Prints the most recent saved report.

## Metadata written

Metadata goes into the existing `sourceData` JSON fields. There is no schema change.
New keys are merged into what is already there and never replace it. A `sourceData`
value that is not an object is left alone and reported.

- `offer.sourceData`: `checkedAt`, `source` (`dataforseo` or `zenrows`, meaning where
  the current price came from), `availability`, `sellerTitle`, `verifiedAt`,
  `verifiedPrice`. When `--drop-stale` clears a price, it also records
  `staleClearedAt` and `clearedPriceAud`.
- `product.sourceData.pricesCheckedAt`
- `product.googleProductId` and `product.sourceData.googleLink` (`link --write`, matched only)

All writes pass `context: { skipRevalidation: true }`. Product pages revalidate every
5 minutes, so no deploy is needed.

## Budgets and safety

- DataForSEO's published Standard-queue prices (dataforseo.com/pricing, checked
  2026-10-17): Google Shopping **Products $0.001 per SERP** of up to 40 results (depth
  41–80 is 2 SERPs; `search` uses depth 100 = 3 SERPs), **Product Info $0.001 per
  product**. The priority queue costs double and is not used.
- `--max-cost` (USD, default 1) caps DataForSEO spending. Before each `task_post` it
  estimates the cost (the published price plus a 50% margin, $0.0015 per unit, refined
  from the real `cost` once one batch has been posted) and posts only what fits.
  Products that were not looked up are listed in the report.
- Linking every inactive product: 184 × ($0.001 search + $0.001 product_info) =
  **about $0.37** at published prices (the budget guard counts up to $0.55). `link`
  prints this for its own scope before posting.
- `--max-requests` (default 50) caps ZenRows calls. Credits are summed from the
  `X-Request-Cost` header. Checks that were skipped are listed in the report.
- A lock file (`app/scratch/price-runs/prices.lock`) stops two runs from overlapping.
  If the lock was left by a process that has died, the next run takes it over.
- If `DATAFORSEO_LOGIN`/`DATAFORSEO_PASSWORD` or `ZENROWS_API_KEY` is missing, the
  tool stops before doing anything. This check is skipped in fixture mode.

## Offline fixture mode

`--fixture <dir>` reads recorded responses instead of calling the APIs. It still
**reads** Payload, and DataForSEO costs are simulated so `--max-cost` can be tested.
`--write` is refused in this mode. In fixture mode, only products that have fixtures
are considered.

```bash
scripts/prices.sh refresh --fixture app/scripts/commerce/fixtures --limit 5
scripts/prices.sh zenrows --fixture app/scripts/commerce/fixtures --verify --fill
scripts/prices.sh search "aqara hub" --fixture app/scripts/commerce/fixtures
```

`fixtures/` holds **synthetic**, hand-written data, marked as such in every file.
Its layout:

- `dataforseo/product_info/<googleProductId>.json` and
  `dataforseo/products/<keyword-slug>.json` (for `search`) and
  `dataforseo/products/<product slug>.json` (for `link`) contain `task_get/advanced` envelopes.
- `zenrows/*.html` contains retailer pages. `manifest.json` maps them by
  `<product|search>:<Retailer>:<product slug>`.

The fixtures reference real catalogue products (by `googleProductId` and slug) so they
produce a diff against the live database. They cover:

- a price change
- a new AU retailer
- grey-market sellers being excluded (Desertcart, Ubuy, AliExpress)
- an Amazon.com listing rejected by the host allow-list
- a retailer with no Merchant record (Costco)
- holds beyond ×1.5, both upward and downward
- a seller with no price
- an empty result
- a stale offer
- prices from JSON-LD (Offer, an array, `@graph`, AggregateOffer), from meta and
  microdata, and from the Amazon selector
- a page with no price
- gap-fill candidates rejected for variant or accessory words

If the catalogue changes, a fixture diff may change too.

## Tests

```bash
cd app && ./node_modules/.bin/tsx --test scripts/commerce/tests/*.test.ts
```

`tests/link.test.ts` covers the link decision against `fixtures/dataforseo/products/fixture-link-*.json`
(matched, ambiguous, no match), GTIN and short-model cases, query building and the
per-SERP budget guard. `tests/prices.test.ts` covers `parseAud`/`extractPrice` (every fixture format), the retailer
matcher, identity matching, and the plan rules (update, add, hold, stale,
`--drop-stale`, skips, de-duplication, product price, `sourceData` merge).

## Scheduling later

Nothing is scheduled yet. A cron job can call the tool directly; the lock makes
overlapping runs safe:

```cron
# 30 4 * * *  /kspellman/sites/nxtsmarthome.com.au/scripts/prices.sh refresh --limit 60 --write --max-cost 0.25 >> /var/log/nxt-prices.log 2>&1
```

The exit code is non-zero on errors, including failed writes.

## Files

- `prices.ts`: the CLI
- `lib/au-retailers.ts`: the AU retailer matcher (ported from `refresh-prices.mjs`
  and extended with the existing Merchants), the excluded sellers, the host
  allow-lists and ZenRows search URLs
- `lib/dataforseo.ts`: the `task_post`/`task_get` client, with polling, a timeout,
  cost tracking and `--max-cost`. Google Shopping on DataForSEO has no live endpoint.
- `lib/zenrows.ts`: the ZenRows client, with concurrency, retries, credits and
  `--max-requests`
- `lib/extract-price.ts`: price and search-result extraction from HTML (pure)
- `lib/match.ts`: identity matching on brand plus model, or GTIN (pure)
- `lib/link.ts`: the `link` query and matched/ambiguous/no-match decision (pure)
- `lib/plan.ts`: the diff and plan rules (pure)
- `lib/store.ts`: Payload reads, and writes with `--write`
- `lib/report.ts`: JSON and Markdown reports, and the run lock
