/**
 * Tests for the `link` command's pure parts: query building, identity, and the
 * matched / ambiguous / no-match decision, using the synthetic Shopping fixtures in
 * fixtures/dataforseo/products/fixture-link-*.json. No network, no database.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chooseLink, linkModels, linkQuery, summariseLinks, type LinkProduct } from '../lib/link'
import { brandAliases, distinctiveModelTokens, identityMatch } from '../lib/match'
import { DataForSeoClient, serpsFor, type DfsShoppingItem } from '../lib/dataforseo'
import { specValue } from '../lib/store'

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'fixtures')
const shopping = (slug: string): DfsShoppingItem[] =>
  JSON.parse(fs.readFileSync(path.join(FIXTURES, 'dataforseo', 'products', `${slug}.json`), 'utf8')).tasks[0].result[0].items
const prod = (p: Partial<LinkProduct> & { slug: string; name: string; brand: string | null }): LinkProduct => ({ id: 1, gtin: null, ...p })

const eufy = prod({ slug: 'fixture-link-eufy-indoor-cam-e220', brand: 'eufy Security', name: 'Indoor Cam E220 2K Pan & Tilt' })
const tapo = prod({ slug: 'fixture-link-tp-link-tapo-c200', brand: 'TP-Link', name: 'Tapo C200 Pan/Tilt Home Security Wi-Fi Camera' })
const aqara = prod({ slug: 'fixture-link-aqara-smart-lock-u200', brand: 'Aqara', name: 'Smart Lock U200' })

test('distinctive model tokens drop spec-like tokens; brand aliases drop generic suffixes', () => {
  assert.deepEqual(distinctiveModelTokens('Indoor Cam E220 2K Pan & Tilt 1080p 5GHz IP65'), ['e220'])
  assert.deepEqual(distinctiveModelTokens('Tapo C200 Wi-Fi 6 20W'), ['c200'])
  assert.deepEqual(distinctiveModelTokens('Smart Plug 2 Pack'), [])
  assert.deepEqual(brandAliases('eufy Security'), ['eufy security', 'eufy'])
  assert.deepEqual(brandAliases('TP-Link'), ['tp link'])
  assert.deepEqual(brandAliases('Google Nest'), ['google nest'])
})

test('link query: brand + distinctive model tokens, else brand + name; spec model number as fallback', () => {
  assert.equal(linkQuery(eufy), 'eufy e220')
  assert.equal(linkQuery(tapo), 'tp link c200')
  assert.equal(linkQuery(prod({ slug: 'x', brand: 'Arlec', name: 'Grid Connect Smart Plug In Socket' })), 'arlec grid connect smart plug in socket')
  const withSpec = prod({ slug: 'y', brand: 'Arlec', name: 'Grid Connect Smart Plug', modelNumber: 'PC191HA' })
  assert.deepEqual(linkModels(withSpec), ['pc191ha'])
  assert.equal(linkQuery(withSpec), 'arlec pc191ha')
})

test('identityMatch: ecosystem phrases are not accessories; a models override skips spec tokens', () => {
  const p = { brand: 'eufy Security', name: 'Indoor Cam E220 2K' }
  assert.equal(identityMatch(p, { title: 'eufy Indoor Cam E220 Compatible with Alexa' }, { models: ['e220'] }).match, true)
  assert.equal(identityMatch(p, { title: 'eufy Indoor Cam E220' }).match, false) // default still requires "2k"
  assert.equal(identityMatch(p, { title: 'Mount for eufy Indoor Cam E220' }, { models: ['e220'] }).match, false)
})

test('MATCHED: one Google product with brand + model; accessory and other model rejected', () => {
  const r = chooseLink(eufy, shopping(eufy.slug))
  assert.equal(r.status, 'matched')
  assert.equal(r.googleProductId, '9900000000000000001')
  assert.equal(r.by, 'brand+model')
  assert.equal(r.confidence, 'high')
  assert.match(r.reason, /e220/)
  const byTitle = new Map(r.candidates.map((c) => [c.productId, c]))
  assert.equal(byTitle.get('9900000000000000002')?.match, false) // wall mount
  assert.match(byTitle.get('9900000000000000002')!.reason, /mount|bracket|for/)
  assert.equal(byTitle.get('9900000000000000003')?.match, false) // C220
  assert.equal(r.candidates.length, 3) // duplicate listings of one product collapse
})

test('AMBIGUOUS: two different Google products both match', () => {
  const r = chooseLink(tapo, shopping(tapo.slug))
  assert.equal(r.status, 'ambiguous')
  assert.equal(r.googleProductId, undefined)
  assert.match(r.reason, /2 different Google products/)
  assert.deepEqual(r.candidates.map((c) => c.productId).sort(), ['9900000000000000011', '9900000000000000012'])
})

test('NO MATCH: other models, other brands and a Pro variant only', () => {
  const r = chooseLink(aqara, shopping(aqara.slug))
  assert.equal(r.status, 'no-match')
  assert.equal(r.googleProductId, undefined)
  const reasons = r.candidates.map((c) => c.reason).join(' | ')
  assert.match(reasons, /model u200 not in title/)
  assert.match(reasons, /brand "Aqara" not in title/)
  assert.match(reasons, /variant\/accessory word\(s\) in title: pro, kit/)
  assert.equal(chooseLink(aqara, []).status, 'no-match')
})

test('an id already linked to another product is ambiguous, not matched', () => {
  const r = chooseLink(eufy, shopping(eufy.slug), { linkedIds: new Map([['9900000000000000001', 'some-other-product']]) })
  assert.equal(r.status, 'ambiguous'); assert.match(r.reason, /already linked to some-other-product/)
})

test('GTIN: identical barcode matches without a model; a different one blocks', () => {
  const plug = prod({ slug: 'p', brand: 'Arlec', name: 'Grid Connect Smart Plug', gtin: '9311234567890' })
  const items: DfsShoppingItem[] = [{ rank_absolute: 1, title: 'Arlec Smart Plug', product_id: '1', gtin: '09311234567890' } as DfsShoppingItem]
  const r = chooseLink(plug, items)
  assert.equal(r.status, 'matched'); assert.equal(r.by, 'gtin')
  const wrong = chooseLink(plug, [{ rank_absolute: 1, title: 'Arlec Smart Plug', product_id: '1', gtin: '9311234567891' } as DfsShoppingItem])
  assert.equal(wrong.status, 'no-match')
  // no model, no GTIN on the product: never matched by title alone
  assert.equal(chooseLink({ ...plug, gtin: null }, [{ rank_absolute: 1, title: 'Arlec Grid Connect Smart Plug', product_id: '1' }]).status, 'no-match')
})

test('short model tokens need the rest of the name too', () => {
  const p = prod({ slug: 's', brand: 'Smartmi', name: 'Air Purifier C1' })
  assert.equal(chooseLink(p, [{ rank_absolute: 1, title: 'Smartmi Air Purifier C1', product_id: '5' }]).status, 'matched')
  const weak = chooseLink(prod({ slug: 's', brand: 'Smartmi', name: 'Evaporative Humidifier Tower C1' }), [{ rank_absolute: 1, title: 'Smartmi C1 Fan', product_id: '6' }])
  assert.equal(weak.status, 'ambiguous'); assert.match(weak.reason, /short model number/)
})

test('matching listing without a Google product id cannot be linked', () => {
  assert.equal(chooseLink(eufy, [{ rank_absolute: 1, title: 'eufy Indoor Cam E220', product_id: null }]).status, 'no-match')
})

test('summariseLinks counts by status', () => {
  const s = summariseLinks([chooseLink(eufy, shopping(eufy.slug)), chooseLink(tapo, shopping(tapo.slug)), chooseLink(aqara, shopping(aqara.slug))])
  assert.deepEqual(s, { products: 3, matched: 1, ambiguous: 1, noMatch: 1, errors: 0, notSearched: 0, written: 0 })
})

test('specValue reads GTIN / model from specifications arrays and productInformation objects', () => {
  assert.equal(specValue([[{ name: 'Brand', value: 'eufy' }, { name: 'Item model number', value: 'T8410' }]], ['item model number']), 'T8410')
  assert.equal(specValue([null, { 'EAN‎': '0194644012345' }], ['ean']), '0194644012345')
  assert.equal(specValue([[], {}], ['ean']), null)
})

test('productsMany in fixture mode: one task per product, per-SERP cost, --max-cost respected', async () => {
  assert.equal(serpsFor(40), 1); assert.equal(serpsFor(41), 2); assert.equal(serpsFor(100), 3)
  const dfs = new DataForSeoClient({ maxCost: 0.003, fixtureDir: FIXTURES })
  const out = await dfs.productsMany([eufy, tapo, aqara].map((p) => ({ tag: p.slug, keyword: linkQuery(p) })))
  assert.equal(dfs.tasksPosted, 2) // $0.0015 guard estimate each: only two fit in $0.003
  assert.deepEqual(dfs.skippedForBudget, [aqara.slug])
  assert.equal(out.get(eufy.slug)?.result?.length, 5)
  assert.equal(out.has(aqara.slug), false)
})
