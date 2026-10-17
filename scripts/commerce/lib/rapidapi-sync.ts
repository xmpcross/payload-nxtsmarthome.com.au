/**
 * Pure helpers for scripts/commerce/rapidapi-sync.ts: choose the right Google Shopping
 * product for a catalogue product, turn the API's price history and reviews into the
 * shapes the site stores, and merge them into what is already there. No network, no
 * Payload: everything here is unit-tested.
 */
import { identityMatch, normalise } from './match'
import { matchRetailer, retailerByName, type AuRetailer } from './au-retailers'
import { parseAud } from './extract-price'
import { HISTORY_DAYS, type PricePoint } from './plan'

export interface SearchHit { product_id: string; product_title: string }
export interface ApiHistoryOffer { store_name?: string; offer_page_url?: string; price?: string; price_history?: { date: string; price: string }[] }
export interface ApiReview {
  review_id?: string; review_title?: string; rating?: number; review_text?: string
  review_datetime_utc?: string; review_date?: string; review_source?: string; review_source_url?: string
}
export interface StoredReview { id: string; body: string; title?: string; rating: number; postedAt?: string; sourceLabel?: string; sourceUrl?: string }

export interface PickResult { hit: SearchHit | null; by?: string; tried: { title: string; reason: string }[] }

/** First search result that is certainly the same product (brand + every model token, or GTIN). */
export function pickCandidate(product: { brand: string | null; name: string; gtin: string | null }, hits: SearchHit[]): PickResult {
  const tried: PickResult['tried'] = []
  for (const hit of hits) {
    const r = identityMatch({ brand: product.brand, name: product.name, gtin: product.gtin }, { title: hit.product_title })
    if (r.match) return { hit, by: r.by, tried }
    tried.push({ title: hit.product_title, reason: r.reason })
  }
  return { hit: null, tried }
}

/** The search text: brand plus name, brand not repeated, kept short enough for a search box. */
export function searchQuery(product: { brand: string | null; name: string }): string {
  const name = product.name.trim()
  const q = product.brand && !normalise(name).startsWith(normalise(product.brand)) ? `${product.brand} ${name}` : name
  return q.split(/\s+/).slice(0, 14).join(' ')
}

/** "$1,299.00" daily points as {d, p}, kept to the last HISTORY_DAYS days, oldest first. Unparseable prices are dropped. */
export function historyPoints(raw: ApiHistoryOffer['price_history'], today: Date): PricePoint[] {
  const cutoff = new Date(today.getTime() - HISTORY_DAYS * 86_400_000).toISOString().slice(0, 10)
  const byDay = new Map<string, number>()
  for (const x of raw ?? []) {
    const p = parseAud(x?.price)
    if (p != null && typeof x.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x.date) && x.date >= cutoff) byDay.set(x.date, p)
  }
  return [...byDay].map(([d, p]) => ({ d, p })).sort((a, b) => a.d.localeCompare(b.d))
}

/** Existing own-recorded points win on the same day; imported points fill the rest. */
export function mergeHistory(existing: unknown, imported: PricePoint[]): PricePoint[] {
  const byDay = new Map<string, number>()
  for (const x of imported) byDay.set(x.d, x.p)
  if (Array.isArray(existing)) for (const x of existing) if (x && typeof x.d === 'string' && typeof x.p === 'number') byDay.set(x.d, x.p)
  return [...byDay].map(([d, p]) => ({ d, p })).sort((a, b) => a.d.localeCompare(b.d)).slice(-HISTORY_DAYS)
}

export interface OfferRef { id: number; merchantName: string; url: string; priceAud: number | null; active: boolean; sourceData: Record<string, unknown> }
export interface HistoryAttach { offerId: number; retailer: string; points: PricePoint[]; latest: number | null; skipped?: undefined }
export interface HistorySkip { retailer: string; sellerTitle: string; reason: string }

/**
 * Which of our offers each API seller's history belongs to. A history is attached only when:
 *  - the seller is a recognised AU retailer (not a grey-market or marketplace seller; eBay is skipped,
 *    because an eBay "seller" is one person's listing, not the product);
 *  - we hold an active offer from the same retailer for this product;
 *  - its latest price is within ratio of our stored price (a bigger gap is another variant or listing).
 */
export function attachHistories(offers: OfferRef[], apiOffers: ApiHistoryOffer[], today: Date, ratio = 1.5): { attach: HistoryAttach[]; skipped: HistorySkip[] } {
  const attach: HistoryAttach[] = [], skipped: HistorySkip[] = []
  const used = new Set<number>()
  for (const a of apiOffers) {
    const seller = String(a.store_name ?? '')
    const m = matchRetailer(seller)
    if (m.status !== 'matched') { skipped.push({ retailer: '-', sellerTitle: seller, reason: m.status === 'excluded' ? m.reason : 'not a recognised AU retailer' }); continue }
    const retailer: AuRetailer = m.retailer
    if (retailer.name === 'eBay AU') { skipped.push({ retailer: retailer.name, sellerTitle: seller, reason: 'eBay listings are individual sellers' }); continue }
    const points = historyPoints(a.price_history, today)
    if (!points.length) { skipped.push({ retailer: retailer.name, sellerTitle: seller, reason: 'no price history returned' }); continue }
    const ours = offers.find((o) => o.active && !used.has(o.id) && (retailerByName(o.merchantName)?.name === retailer.name))
    if (!ours) { skipped.push({ retailer: retailer.name, sellerTitle: seller, reason: 'we have no active offer from this retailer' }); continue }
    const latest = points[points.length - 1].p
    if (ours.priceAud != null && (latest > ours.priceAud * ratio || latest < ours.priceAud / ratio)) {
      skipped.push({ retailer: retailer.name, sellerTitle: seller, reason: `latest history price $${latest} is far from our $${ours.priceAud}: probably a different variant` }); continue
    }
    used.add(ours.id)
    attach.push({ offerId: ours.id, retailer: retailer.name, points, latest })
  }
  return { attach, skipped }
}

const reviewKey = (r: Pick<StoredReview, 'sourceLabel' | 'postedAt' | 'body'>) => `${normalise(r.sourceLabel)}|${(r.postedAt ?? '').slice(0, 10)}|${normalise(r.body).slice(0, 80)}`

/** API reviews in the site's stored shape. Author names are not kept. Unusable reviews are dropped. */
export function mapReviews(raw: ApiReview[]): StoredReview[] {
  const out: StoredReview[] = []
  for (const r of raw ?? []) {
    const body = String(r.review_text ?? '').trim()
    const rating = Number(r.rating)
    if (!body || !Number.isFinite(rating) || rating < 1 || rating > 5) continue
    const posted = r.review_datetime_utc || r.review_date
    out.push({
      id: `rapidapi:${r.review_id ?? reviewKey({ sourceLabel: r.review_source, postedAt: posted, body })}`,
      body,
      ...(r.review_title?.trim() ? { title: r.review_title.trim() } : {}),
      rating: Math.round(rating),
      ...(posted ? { postedAt: posted } : {}),
      ...(r.review_source ? { sourceLabel: r.review_source } : {}),
      ...(r.review_source_url ? { sourceUrl: r.review_source_url } : {}),
    })
  }
  return out
}

/** New reviews appended after the existing ones; nothing existing is changed, duplicates are skipped. */
export function mergeReviews(existing: unknown, incoming: StoredReview[]): { merged: unknown[]; added: number } {
  const base = Array.isArray(existing) ? existing as StoredReview[] : []
  const ids = new Set(base.map((r) => r?.id).filter(Boolean))
  const keys = new Set(base.filter((r) => r && typeof r.body === 'string').map((r) => reviewKey(r)))
  const add = incoming.filter((r) => !ids.has(r.id) && !keys.has(reviewKey(r)))
  return { merged: [...base, ...add], added: add.length }
}
