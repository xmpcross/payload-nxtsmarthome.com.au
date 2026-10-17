import { test } from 'node:test'
import assert from 'node:assert/strict'
import { attachHistories, historyPoints, mapReviews, mergeHistory, mergeReviews, pickCandidate, searchQuery, type OfferRef } from '../lib/rapidapi-sync'

const TODAY = new Date('2026-10-17T00:00:00Z')

test('only a confident brand+model match is picked', () => {
  const p = { brand: 'Aqara', name: 'Smart Lock U100', gtin: null }
  assert.equal(pickCandidate(p, [{ product_id: 'a', product_title: 'Aqara Smart Lock U100 with M100 Hub Kit' }, { product_id: 'b', product_title: 'Aqara Smart Door Lock U100' }]).hit?.product_id, 'b') // the kit is a variant
  assert.equal(pickCandidate(p, [{ product_id: 'c', product_title: 'Yale Smart Lock YDM4109' }]).hit, null)
  assert.equal(pickCandidate({ brand: 'Acme', name: 'Smart Plug Mini', gtin: null }, [{ product_id: 'd', product_title: 'Acme Smart Plug Mini' }]).hit, null) // no model number: needs a GTIN
})
test('search query keeps the brand once and stays short', () => {
  assert.equal(searchQuery({ brand: 'Aqara', name: 'Aqara Hub M3' }), 'Aqara Hub M3')
  assert.equal(searchQuery({ brand: 'Aqara', name: 'Hub M3' }), 'Aqara Hub M3')
  assert.ok(searchQuery({ brand: 'X', name: Array(40).fill('word').join(' ') }).split(' ').length <= 14)
})
test('history points: parsed, last 90 days only, sorted, bad prices dropped', () => {
  const pts = historyPoints([{ date: '2026-10-16', price: '$279.00' }, { date: '2025-10-16', price: '$499.99' }, { date: '2026-10-10', price: '$1,299.00' }, { date: '2026-10-11', price: 'n/a' }], TODAY)
  assert.deepEqual(pts, [{ d: '2026-10-10', p: 1299 }, { d: '2026-10-16', p: 279 }])
})
test('merge: our own recorded day wins, imported fills the gaps, order kept', () => {
  const m = mergeHistory([{ d: '2026-10-16', p: 100 }], [{ d: '2026-10-15', p: 90 }, { d: '2026-10-16', p: 999 }])
  assert.deepEqual(m, [{ d: '2026-10-15', p: 90 }, { d: '2026-10-16', p: 100 }])
})
const offer = (id: number, merchantName: string, priceAud: number | null): OfferRef => ({ id, merchantName, url: 'https://x', priceAud, active: true, sourceData: {} })
const api = (store_name: string, price: string) => ({ store_name, price, price_history: [{ date: '2026-10-16', price }] })
test('history attaches only to our matching retailer offer', () => {
  const r = attachHistories([offer(1, 'Amazon AU', 129), offer(2, 'JB Hi-Fi', 129)], [api('Amazon AU', '$129.00'), api('Officeworks', '$127.00'), api('u-buy.com.au', '$99.00'), api('eBay - shopatsa', '$1,000.00')], TODAY)
  assert.deepEqual(r.attach.map((a) => [a.offerId, a.retailer]), [[1, 'Amazon AU']])
  const reasons = r.skipped.map((s) => s.reason).join(' | ')
  assert.match(reasons, /no active offer/); assert.match(reasons, /grey-market/); assert.match(reasons, /eBay/)
})
test('a history far from our stored price is treated as a different variant', () => {
  const r = attachHistories([offer(1, 'Amazon AU', 129)], [api('Amazon AU', '$499.00')], TODAY)
  assert.equal(r.attach.length, 0); assert.match(r.skipped[0].reason, /different variant/)
})
test('reviews: mapped to the stored shape without author, unusable ones dropped', () => {
  const m = mapReviews([{ review_id: 'r1', review_title: ' Great ', rating: 5, review_text: 'Works well', review_datetime_utc: '2025-10-17T00:00:00.000Z', review_source: 'walmart.ca', review_source_url: 'https://w' }, { review_id: 'r2', rating: 5, review_text: '' }, { review_id: 'r3', rating: 9, review_text: 'x' }])
  assert.equal(m.length, 1); assert.deepEqual(Object.keys(m[0]).sort(), ['body', 'id', 'postedAt', 'rating', 'sourceLabel', 'sourceUrl', 'title']); assert.equal(m[0].id, 'rapidapi:r1')
})
test('reviews: existing ones are untouched and duplicates are skipped', () => {
  const existing = [{ id: 'old', body: 'Works well', rating: 4, sourceLabel: 'walmart.ca', postedAt: '2025-10-17T00:00:00.000Z' }]
  const incoming = mapReviews([{ review_id: 'r1', rating: 5, review_text: 'Works well', review_datetime_utc: '2025-10-17T00:00:00.000Z', review_source: 'walmart.ca' }, { review_id: 'r9', rating: 3, review_text: 'Different review', review_source: 'harveynorman.com.au' }])
  const r = mergeReviews(existing, incoming)
  assert.equal(r.added, 1); assert.equal(r.merged.length, 2); assert.equal((r.merged[0] as { id: string }).id, 'old')
})
