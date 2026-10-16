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

### `refresh [--product slug] [--limit N] [--write] [--drop-stale] [--max-cost 1]`

Calls DataForSEO `product_info` for each active product that has a `googleProductId`.
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

On `--write`, each checked product gets `sourceData.pricesCheckedAt`, which the
"Last price update" line reads. Its `priceAud` is then recalculated from the offers
now in the database, as the lowest active offer price.

```bash
scripts/prices.sh refresh --limit 20                     # review
scripts/prices.sh refresh --product aqara-hub-m100       # one product
scripts/prices.sh refresh --limit 20 --write             # apply
scripts/prices.sh refresh --write --drop-stale --max-cost 0.5
```

### `zenrows [--product slug] [--retailer name] [--verify|--fill] [--limit 10] [--write] [--max-requests 50]`

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
  only be matched by GTIN.

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

All writes pass `context: { skipRevalidation: true }`. Product pages revalidate every
5 minutes, so no deploy is needed.

## Budgets and safety

- `--max-cost` (USD, default 1) caps DataForSEO spending. Before each `task_post` it
  estimates the cost (about $0.0015 per task, refined from the real `cost` once one
  batch has been posted) and posts only what fits. Products that were not looked up
  are listed in the report.
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
  `dataforseo/products/<keyword-slug>.json` contain `task_get/advanced` envelopes.
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

The tests cover `parseAud`/`extractPrice` (every fixture format), the retailer
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
- `lib/plan.ts`: the diff and plan rules (pure)
- `lib/store.ts`: Payload reads, and writes with `--write`
- `lib/report.ts`: JSON and Markdown reports, and the run lock
