/**
 * Unit tests for the pure parts of the price tools. No network, no database.
 *   app/node_modules/.bin/tsx --test app/scripts/commerce/tests/*.test.ts
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { extractPrice, extractSearchResults, parseAud } from '../lib/extract-price'
import { planProduct, mergeSourceData, productPriceAfter, type PlanProduct, type PlanOffer, type Observation } from '../lib/plan'
import { matchRetailer, resolveMerchants, hostAllowed, retailerByName } from '../lib/au-retailers'
import { identityMatch, findInCatalogue, modelTokens } from '../lib/match'

const FIX = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'zenrows')
const html = (f: string) => fs.readFileSync(path.join(FIX, f), 'utf8')

// ------------------------------------------------------------ parseAud
test('parseAud handles AU formats', () => {
  assert.equal(parseAud('$1,299.00'), 1299)
  assert.equal(parseAud('AU $67.11'), 67.11)
  assert.equal(parseAud('A$49'), 49)
  assert.equal(parseAud('AUD 49.95'), 49.95)
  assert.equal(parseAud('  $ 139.38 '), 139.38)
  assert.equal(parseAud('From $49'), 49)
  assert.equal(parseAud('349'), 349)
  assert.equal(parseAud(349.499), 349.5)
  assert.equal(parseAud('&#36;99.95'), 99.95)
})

test('parseAud rejects other currencies, ranges and junk', () => {
  assert.equal(parseAud('US$49.99'), null)
  assert.equal(parseAud('USD 49.99'), null)
  assert.equal(parseAud('€49'), null)
  assert.equal(parseAud('NZ$59'), null)
  assert.equal(parseAud('$49 - $59'), null)
  assert.equal(parseAud('$49 to $59'), null)
  assert.equal(parseAud('Call for price'), null)
  assert.equal(parseAud(''), null)
  assert.equal(parseAud(0), null)
  assert.equal(parseAud(-5), null)
  assert.equal(parseAud(undefined), null)
})

// ------------------------------------------------------------ extractPrice
test('JSON-LD Offer price', () => {
  const x = extractPrice(html('jbhifi-smartmi-c1.html'), 'JB Hi-Fi')
  assert.equal(x.price, 139.38); assert.equal(x.method, 'json-ld'); assert.equal(x.availability, 'in_stock'); assert.equal(x.brand, 'Smartmi')
})

test('JSON-LD in an array with a numeric price', () => {
  const x = extractPrice(html('bunnings-smartmi-c1.html'), 'Bunnings')
  assert.equal(x.price, 139); assert.equal(x.method, 'json-ld')
})

test('JSON-LD @graph AggregateOffer lowPrice and gtin13', () => {
  const x = extractPrice(html('jbhifi-aqara-m100.html'), 'JB Hi-Fi')
  assert.equal(x.price, 39); assert.equal(x.method, 'json-ld'); assert.equal(x.gtin, '6970504219681')
})

test('meta product:price:amount', () => {
  const x = extractPrice(html('amazon-aqara-m100.html'), 'Amazon AU')
  assert.equal(x.price, 37); assert.equal(x.method, 'meta'); assert.equal(x.availability, 'in_stock')
})

test('meta itemprop price (microdata)', () => {
  const x = extractPrice(html('harveynorman-smartmi-c1.html'), 'Harvey Norman')
  assert.equal(x.price, 149); assert.equal(x.method, 'meta')
})

test('retailer selector fallback (Amazon a-offscreen)', () => {
  const x = extractPrice(html('amazon-smartmi-c1.html'), 'Amazon AU')
  assert.equal(x.price, 134); assert.equal(x.method, 'selector')
})

test('eBay x-price-primary selector', () => {
  const x = extractPrice('<div class="x-price-primary" data-testid="x-price-primary"><span class="ux-textspans">AU $67.11</span></div>', 'eBay AU')
  assert.equal(x.price, 67.11)
})

test('page with no price', () => {
  const x = extractPrice(html('bunnings-aqara-m100.html'), 'Bunnings')
  assert.equal(x.price, null); assert.match(x.reason ?? '', /no JSON-LD/)
})

test('a non-AUD JSON-LD price is rejected and not rescued by weaker signals', () => {
  const page = `<script type="application/ld+json">{"@type":"Product","offers":{"@type":"Offer","price":"49.99","priceCurrency":"USD"}}</script>
    <meta property="product:price:amount" content="49.99"><span class="a-offscreen">$49.99</span>`
  const x = extractPrice(page, 'Amazon AU')
  assert.equal(x.price, null); assert.match(x.reason ?? '', /USD/)
})

test('a non-AUD meta price is rejected', () => {
  const x = extractPrice('<meta property="og:price:amount" content="10"><meta property="og:price:currency" content="NZD">')
  assert.equal(x.price, null)
})

test('malformed JSON-LD is skipped', () => {
  const x = extractPrice('<script type="application/ld+json">{oops</script><meta itemprop="price" content="12.50">')
  assert.equal(x.price, 12.5); assert.equal(x.method, 'meta')
})

test('search results from anchors and from JSON-LD ItemList', () => {
  const hn = extractSearchResults(html('harveynorman-search-smartmi.html'), 'https://www.harveynorman.com.au/catalogsearch/result/?q=x', /\/[a-z0-9-]+\.html$/i)
  assert.deepEqual(hn.map((r) => r.title), ['Smartmi Air Purifier P2', 'Smartmi Air Purifier C1', 'Customer service'])
  assert.equal(hn[1].url, 'https://www.harveynorman.com.au/smartmi-air-purifier-c1.html')
  const jb = extractSearchResults(html('jbhifi-search-aqara-m100.html'), 'https://www.jbhifi.com.au/search?query=x', /\/products\/[a-z0-9-]+/i)
  assert.equal(jb[0].title, 'Aqara Hub M100 (White)')
})

// ------------------------------------------------------------ retailers / identity
test('matchRetailer: AU retailers, exclusions and host allow-list', () => {
  const m = matchRetailer('Amazon AU - Amazon.com.au', 'https://www.amazon.com.au/dp/X')
  assert.equal(m.status, 'matched')
  assert.equal(matchRetailer('Amazon.com', 'https://www.amazon.com/dp/X').status, 'host-mismatch')
  assert.equal(matchRetailer('Desertcart AU', 'https://www.desertcart.com.au/x').status, 'excluded')
  assert.equal(matchRetailer('Big Apple Buddy', 'https://www.bigapplebuddy.com/x').status, 'excluded')
  assert.equal(matchRetailer('Mighty Ape', 'https://www.mightyape.com.au/x').status, 'unknown')
  const b = matchRetailer('Bunnings Warehouse', 'https://www.bunnings.com.au/x_p1')
  assert.ok(b.status === 'matched' && b.retailer.name === 'Bunnings')
  assert.ok(hostAllowed(retailerByName('eBay AU')!, 'https://www.ebay.com.au/itm/1'))
  assert.ok(!hostAllowed(retailerByName('eBay AU')!, 'https://www.ebay.com/itm/1'))
})

test('resolveMerchants reports retailers without a Merchant record', () => {
  const { lookup, missing } = resolveMerchants([{ id: 1, name: 'Amazon AU' }, { id: 2, name: 'jb hi-fi' }])
  assert.equal(lookup.get('Amazon AU')?.id, 1); assert.equal(lookup.get('JB Hi-Fi')?.id, 2)
  assert.ok(missing.includes('Costco AU'))
})

test('identityMatch needs brand + model or GTIN', () => {
  const p = { brand: 'Aqara', name: 'Hub M100' }
  assert.deepEqual(modelTokens('Hub M100'), ['m100'])
  assert.equal(identityMatch(p, { title: 'Aqara Hub M100 (White)' }).match, true)
  assert.equal(identityMatch(p, { title: 'Aqara Hub M1S' }).match, false)
  assert.equal(identityMatch(p, { title: 'Aqara Hub M100 Pro' }).match, false)
  assert.equal(identityMatch(p, { title: 'Generic Hub M100' }).match, false)
  assert.equal(identityMatch({ brand: 'Smartmi', name: 'Air Purifier C1' }, { title: 'Smartmi Air Purifier C1 Replacement Filter' }).match, false)
  // No model number in the name: only a GTIN can confirm it.
  const arlec = { brand: 'Arlec', name: 'Grid Connect Smart 4 Outlet Powerboard', gtin: '9311234567890' }
  assert.equal(identityMatch(arlec, { title: 'Arlec Grid Connect Smart 4 Outlet Powerboard' }).match, false)
  assert.equal(identityMatch(arlec, { title: 'anything', gtin: '09311234567890' }).match, true)
  assert.equal(identityMatch(arlec, { title: 'anything', gtin: '9311234567891' }).match, false)
})

test('findInCatalogue: googleProductId, then name, then brand+model', () => {
  const cat = [{ id: 1, slug: 'aqara-hub-m100', brand: 'Aqara', name: 'Hub M100', googleProductId: '111' }, { id: 2, slug: 'aqara-hub-m2', brand: 'Aqara', name: 'Hub M2 Multi-Protocol Hub', googleProductId: null }]
  assert.deepEqual(findInCatalogue({ productId: '111', title: 'x' }, cat), { slug: 'aqara-hub-m100', by: 'googleProductId' })
  assert.deepEqual(findInCatalogue({ productId: '999', title: 'Aqara Hub M100' }, cat), { slug: 'aqara-hub-m100', by: 'name' })
  assert.deepEqual(findInCatalogue({ productId: null, title: 'Aqara Smart Hub M2' }, cat), { slug: 'aqara-hub-m2', by: 'brand+model' })
  assert.equal(findInCatalogue({ productId: null, title: 'Aqara Hub E1' }, cat), null)
})

// ------------------------------------------------------------ plan
const NOW = new Date('2026-10-17T00:00:00Z')
const offer = (o: Partial<PlanOffer> & { id: number; merchantId: number; merchantName: string }): PlanOffer =>
  ({ url: `https://example.com.au/${o.id}`, priceAud: 100, active: true, deepLink: true, order: 0, sourceData: {}, ...o })
const product = (offers: PlanOffer[], extra: Partial<PlanProduct> = {}): PlanProduct =>
  ({ id: 1, slug: 'p', name: 'P', priceAud: Math.min(...offers.map((o) => o.priceAud ?? Infinity)), sourceData: { pricesCheckedAt: '2026-10-15T00:00:00Z' }, offers, ...extra })
const obs = (o: Partial<Observation> & { retailer: string; merchantId: number | null; price: number | null }): Observation =>
  ({ source: 'dataforseo', kind: 'price', url: `https://shop.example.com.au/${o.retailer}`, ...o })

test('price change, unchanged price, new retailer', () => {
  const p = product([offer({ id: 10, merchantId: 1, merchantName: 'A', priceAud: 100, order: 0 }), offer({ id: 11, merchantId: 2, merchantName: 'B', priceAud: 120, order: 3 })])
  const plan = planProduct(p, [obs({ retailer: 'A', merchantId: 1, price: 90 }), obs({ retailer: 'B', merchantId: 2, price: 120 }), obs({ retailer: 'C', merchantId: 3, price: 110 })], { now: NOW })
  const [u, v, a] = plan.changes
  assert.equal(u.kind, 'update'); assert.ok(u.kind === 'update' && u.oldPrice === 100 && u.newPrice === 90)
  assert.equal(v.kind, 'verified')
  assert.ok(a.kind === 'add' && a.order === 4 && a.price === 110 && a.merchantId === 3)
  assert.equal(plan.newPriceAud, 90)
})

test('holds changes beyond x1.5 either way, and suspicious new retailers', () => {
  const p = product([offer({ id: 10, merchantId: 1, merchantName: 'A', priceAud: 100 }), offer({ id: 11, merchantId: 2, merchantName: 'B', priceAud: 100 })])
  const plan = planProduct(p, [obs({ retailer: 'A', merchantId: 1, price: 151 }), obs({ retailer: 'B', merchantId: 2, price: 66 }), obs({ retailer: 'C', merchantId: 3, price: 400 })], { now: NOW })
  assert.deepEqual(plan.changes.map((c) => c.kind), ['hold', 'hold', 'hold'])
  assert.equal(plan.newPriceAud, 100)
  // exactly x1.5 is allowed
  const ok = planProduct(p, [obs({ retailer: 'A', merchantId: 1, price: 150 })], { now: NOW })
  assert.equal(ok.changes[0].kind, 'update')
})

test('skips: no merchant, no price, inactive offer, no direct URL; duplicates keep the lowest', () => {
  const p = product([offer({ id: 10, merchantId: 1, merchantName: 'A', priceAud: 100, active: false }), offer({ id: 12, merchantId: 5, merchantName: 'E', priceAud: 100 })])
  const plan = planProduct(p, [
    obs({ retailer: 'Costco AU', merchantId: null, price: 99 }),
    obs({ retailer: 'B', merchantId: 2, price: null }),
    obs({ retailer: 'A', merchantId: 1, price: 95 }),
    obs({ retailer: 'D', merchantId: 4, price: 99, url: '/relative' }),
    obs({ retailer: 'E', merchantId: 5, price: 98 }), obs({ retailer: 'E', merchantId: 5, price: 97 }),
  ], { now: NOW })
  const reasons = plan.changes.filter((c) => c.kind === 'skip').map((c) => c.kind === 'skip' && c.reason)
  assert.ok(reasons.some((r) => String(r).includes('no Merchant record')))
  assert.ok(reasons.some((r) => String(r).includes('no usable price')))
  assert.ok(reasons.some((r) => String(r).includes('inactive')))
  assert.ok(reasons.some((r) => String(r).includes('no direct product URL')))
  const e = plan.changes.find((c) => c.kind === 'update')
  assert.ok(e?.kind === 'update' && e.newPrice === 97)
  assert.ok(!plan.changes.some((c) => c.kind === 'add'))
})

test('search-URL offers get the direct URL and a missing price is filled', () => {
  const p = product([offer({ id: 10, merchantId: 1, merchantName: 'A', priceAud: null, deepLink: false, url: 'https://a.com.au/search?q=x' })], { priceAud: null })
  const plan = planProduct(p, [obs({ retailer: 'A', merchantId: 1, price: 50, url: 'https://a.com.au/p/1' })], { now: NOW })
  const u = plan.changes[0]
  assert.ok(u.kind === 'update' && u.newPrice === 50 && u.newUrl === 'https://a.com.au/p/1')
  assert.equal(plan.newPriceAud, 50)
})

test('stale offers are reported; cleared only with dropStale; never when seen', () => {
  const p = product([
    offer({ id: 10, merchantId: 1, merchantName: 'A', priceAud: 80, sourceData: { checkedAt: '2026-09-01T00:00:00Z' } }),
    offer({ id: 11, merchantId: 2, merchantName: 'B', priceAud: 100, sourceData: { checkedAt: '2026-10-10T00:00:00Z' } }),
    offer({ id: 12, merchantId: 3, merchantName: 'C', priceAud: 90, sourceData: { checkedAt: '2026-09-01T00:00:00Z' } }),
  ])
  const report = planProduct(p, [obs({ retailer: 'C', merchantId: 3, price: 90 })], { now: NOW, checkStale: true })
  const stale = report.changes.filter((c) => c.kind === 'stale')
  assert.equal(stale.length, 1); assert.ok(stale[0].kind === 'stale' && stale[0].offerId === 10 && !stale[0].drop && stale[0].ageDays === 46)
  assert.equal(report.newPriceAud, 80)
  const drop = planProduct(p, [], { now: NOW, checkStale: true, dropStale: true })
  assert.equal(drop.changes.filter((c) => c.kind === 'stale' && c.drop).length, 2)
  assert.equal(drop.newPriceAud, 100)
  // falls back to the product's pricesCheckedAt when the offer has no checkedAt
  const fallback = planProduct(product([offer({ id: 1, merchantId: 1, merchantName: 'A' })], { sourceData: { pricesCheckedAt: '2026-09-01T00:00:00Z' } }), [], { now: NOW, checkStale: true })
  assert.equal(fallback.changes[0]?.kind, 'stale')
})

test('ZenRows verify observations target one offer and never add', () => {
  const p = product([offer({ id: 10, merchantId: 1, merchantName: 'A', priceAud: 100 })])
  const plan = planProduct(p, [
    obs({ retailer: 'A', merchantId: 1, offerId: 10, price: 100, source: 'zenrows', kind: 'verify' }),
    obs({ retailer: 'B', merchantId: 2, offerId: 99, price: 100, source: 'zenrows', kind: 'verify' }),
  ], { now: NOW })
  assert.ok(plan.changes[0].kind === 'verified' && plan.changes[0].verify)
  assert.equal(plan.changes[1].kind, 'skip')
})

test('product price is the lowest active offer after changes', () => {
  const p = product([offer({ id: 1, merchantId: 1, merchantName: 'A', priceAud: 100 }), offer({ id: 2, merchantId: 2, merchantName: 'B', priceAud: 50, active: false })])
  assert.equal(productPriceAfter(p, []), 100)
  assert.equal(productPriceAfter(p, [{ kind: 'add', retailer: 'C', merchantId: 3, price: 70, url: 'https://c', order: 2, source: 'zenrows' }]), 70)
})

test('mergeSourceData keeps existing keys and never replaces non-objects', () => {
  assert.deepEqual(mergeSourceData({ url: 'u', name: 'n', priceAud: 1 }, { checkedAt: 't', availability: undefined }), { url: 'u', name: 'n', priceAud: 1, checkedAt: 't' })
  assert.deepEqual(mergeSourceData(null, { a: 1 }), { a: 1 })
  assert.equal(mergeSourceData('legacy', { a: 1 }), null)
  assert.equal(mergeSourceData([1], { a: 1 }), null)
})
