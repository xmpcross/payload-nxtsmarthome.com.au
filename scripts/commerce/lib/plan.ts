/**
 * Pure diff logic: current Payload offers + observed prices → a reviewable plan.
 *
 * Rules (carried over from scripts/refresh-prices.mjs, now explicit):
 *   - An offer's price is updated when a new observation differs, unless the change is more
 *     than HOLD_RATIO either way: then it is held for review and nothing changes.
 *   - An unchanged price marks the offer checked (DataForSEO) or verified (ZenRows).
 *   - A retailer with no offer yet is added (deepLink, active, ordered after existing offers),
 *     held instead when its price is more than HOLD_RATIO away from the product's median.
 *   - An offer not seen in this run whose last check is older than STALE_DAYS is reported
 *     stale; its price is cleared only with dropStale. A missing result never blanks a price.
 *   - Offers are never deleted or deactivated, and inactive offers are never reactivated.
 *   - The product price becomes the lowest active offer price after the plan is applied.
 */

export const HOLD_RATIO = 1.5
export const STALE_DAYS = 14

export type Source = 'dataforseo' | 'zenrows'

export interface PlanOffer {
  id: number
  merchantId: number
  merchantName: string
  url: string
  priceAud: number | null
  active: boolean
  deepLink: boolean
  order: number
  sourceData: Record<string, unknown>
}

export interface PlanProduct {
  id: number
  slug: string
  name: string
  priceAud: number | null
  sourceData: Record<string, unknown>
  offers: PlanOffer[]
}

export interface Observation {
  /** Retailer / Merchant name. */
  retailer: string
  /** Payload Merchant id; null when the retailer has no Merchant record. */
  merchantId: number | null
  /** Set when the observation is a check of one specific offer (ZenRows verify). */
  offerId?: number
  price: number | null
  url?: string
  source: Source
  /** 'price' = a price for the retailer (may add an offer); 'verify' = a check of an existing offer's own page. */
  kind: 'price' | 'verify'
  sellerTitle?: string
  availability?: string
}

export type Change =
  | { kind: 'update'; offerId: number; retailer: string; oldPrice: number | null; newPrice: number | null; newUrl?: string; source: Source; verify: boolean; sellerTitle?: string; availability?: string }
  | { kind: 'verified'; offerId: number; retailer: string; price: number; source: Source; verify: boolean; sellerTitle?: string; availability?: string }
  | { kind: 'add'; retailer: string; merchantId: number; price: number; url: string; order: number; source: Source; sellerTitle?: string; availability?: string }
  | { kind: 'hold'; offerId?: number; retailer: string; oldPrice: number; newPrice: number; ratio: number; source: Source; url?: string; note: string }
  | { kind: 'stale'; offerId: number; retailer: string; price: number; lastChecked: string; ageDays: number; drop: boolean }
  | { kind: 'skip'; retailer: string; reason: string; price?: number | null; url?: string }

export interface ProductPlan {
  productId: number
  slug: string
  name: string
  /** True when this run observed anything for the product (its pricesCheckedAt is then refreshed on write). */
  observed: boolean
  oldPriceAud: number | null
  newPriceAud: number | null
  changes: Change[]
  note?: string
}

export interface PlanOptions {
  now: Date
  dropStale?: boolean
  checkStale?: boolean
  holdRatio?: number
  staleDays?: number
  note?: string
}

export const round2 = (n: number) => Math.round(n * 100) / 100
const samePrice = (a: number | null | undefined, b: number | null | undefined) => typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) < 0.005
const isAbsolute = (u: string | null | undefined) => typeof u === 'string' && /^https?:\/\//i.test(u)
const outside = (ratio: number, hold: number) => ratio > hold || ratio < 1 / hold

export function median(nums: number[]): number | null {
  if (!nums.length) return null
  const s = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : round2((s[mid - 1] + s[mid]) / 2)
}

/** When the offer was last checked: its own checkedAt, else the product's pricesCheckedAt. */
export function lastChecked(offer: PlanOffer, product: PlanProduct): string | null {
  const own = offer.sourceData?.checkedAt
  if (typeof own === 'string' && !Number.isNaN(Date.parse(own))) return own
  const p = product.sourceData?.pricesCheckedAt
  return typeof p === 'string' && !Number.isNaN(Date.parse(p)) ? p : null
}

/** Keep one observation per target (offer or merchant): the lowest priced, like the legacy refresher. */
function dedupe(observations: Observation[]): Observation[] {
  const best = new Map<string, Observation>()
  const rest: Observation[] = []
  for (const o of observations) {
    if (o.merchantId == null || o.price == null) { rest.push(o); continue }
    const key = o.offerId != null ? `offer:${o.offerId}` : `merchant:${o.merchantId}`
    const cur = best.get(key)
    if (!cur || o.price < (cur.price ?? Infinity)) best.set(key, o)
  }
  return [...best.values(), ...rest]
}

export function planProduct(product: PlanProduct, observations: Observation[], opts: PlanOptions): ProductPlan {
  const hold = opts.holdRatio ?? HOLD_RATIO
  const staleDays = opts.staleDays ?? STALE_DAYS
  const changes: Change[] = []
  const seenOffers = new Set<number>()
  const seenMerchants = new Set<number>()
  const activePrices = product.offers.filter((o) => o.active && typeof o.priceAud === 'number' && o.priceAud > 0).map((o) => o.priceAud as number)
  const med = median(activePrices)
  let nextOrder = Math.max(-1, ...product.offers.map((o) => o.order ?? 0)) + 1

  for (const obs of dedupe(observations)) {
    if (obs.merchantId == null) {
      changes.push({ kind: 'skip', retailer: obs.retailer, reason: 'no Merchant record in Payload (not created)', price: obs.price, url: obs.url })
      continue
    }
    const existing = obs.offerId != null
      ? product.offers.find((o) => o.id === obs.offerId)
      : [...product.offers].filter((o) => o.merchantId === obs.merchantId).sort((a, b) => Number(b.active) - Number(a.active) || a.order - b.order)[0]
    if (existing) { seenOffers.add(existing.id); seenMerchants.add(existing.merchantId) } else seenMerchants.add(obs.merchantId)

    if (obs.price == null || !(obs.price > 0)) {
      changes.push({ kind: 'skip', retailer: obs.retailer, reason: 'no usable price in the result', url: obs.url })
      continue
    }
    const price = round2(obs.price)
    const verify = obs.kind === 'verify'

    if (existing) {
      if (!existing.active) {
        changes.push({ kind: 'skip', retailer: obs.retailer, reason: `offer #${existing.id} is inactive; not reactivated`, price })
        continue
      }
      const old = existing.priceAud
      const upgradeUrl = !verify && obs.url && isAbsolute(obs.url) && (!existing.deepLink || !isAbsolute(existing.url)) ? obs.url : undefined
      if (typeof old === 'number' && old > 0 && !samePrice(old, price) && outside(price / old, hold)) {
        changes.push({ kind: 'hold', offerId: existing.id, retailer: obs.retailer, oldPrice: old, newPrice: price, ratio: round2(price / old), source: obs.source, url: obs.url,
          note: `change of x${round2(price / old)} exceeds the x${hold} hold limit` })
      } else if (samePrice(old, price) && !upgradeUrl) {
        changes.push({ kind: 'verified', offerId: existing.id, retailer: obs.retailer, price, source: obs.source, verify, sellerTitle: obs.sellerTitle, availability: obs.availability })
      } else {
        changes.push({ kind: 'update', offerId: existing.id, retailer: obs.retailer, oldPrice: old ?? null, newPrice: samePrice(old, price) ? old ?? null : price,
          newUrl: upgradeUrl, source: obs.source, verify, sellerTitle: obs.sellerTitle, availability: obs.availability })
      }
      continue
    }

    if (verify) { changes.push({ kind: 'skip', retailer: obs.retailer, reason: `offer #${obs.offerId} not found on product` }); continue }
    if (!obs.url || !isAbsolute(obs.url)) { changes.push({ kind: 'skip', retailer: obs.retailer, reason: 'no direct product URL', price }); continue }
    if (med != null && outside(price / med, hold)) {
      changes.push({ kind: 'hold', retailer: obs.retailer, oldPrice: med, newPrice: price, ratio: round2(price / med), source: obs.source, url: obs.url,
        note: `new retailer priced x${round2(price / med)} the product's median offer ($${med}); not added` })
      continue
    }
    changes.push({ kind: 'add', retailer: obs.retailer, merchantId: obs.merchantId, price, url: obs.url, order: nextOrder++, source: obs.source, sellerTitle: obs.sellerTitle, availability: obs.availability })
  }

  if (opts.checkStale) {
    for (const offer of product.offers) {
      if (!offer.active || typeof offer.priceAud !== 'number' || seenOffers.has(offer.id) || seenMerchants.has(offer.merchantId)) continue
      const at = lastChecked(offer, product)
      if (!at) continue
      const ageDays = Math.floor((opts.now.getTime() - Date.parse(at)) / 86400000)
      if (ageDays > staleDays) changes.push({ kind: 'stale', offerId: offer.id, retailer: offer.merchantName, price: offer.priceAud, lastChecked: at, ageDays, drop: Boolean(opts.dropStale) })
    }
  }

  return {
    productId: product.id, slug: product.slug, name: product.name,
    observed: observations.length > 0,
    oldPriceAud: product.priceAud ?? null,
    newPriceAud: productPriceAfter(product, changes),
    changes, note: opts.note,
  }
}

/** Lowest active offer price once the changes are applied; the old price when no offer has one. */
export function productPriceAfter(product: PlanProduct, changes: Change[]): number | null {
  const prices = new Map<number | string, number | null>()
  for (const o of product.offers) if (o.active) prices.set(o.id, o.priceAud)
  for (const c of changes) {
    if (c.kind === 'update' && c.newPrice != null) prices.set(c.offerId, c.newPrice)
    else if (c.kind === 'add') prices.set(`new:${c.retailer}`, c.price)
    else if (c.kind === 'stale' && c.drop) prices.set(c.offerId, null)
  }
  const valid = [...prices.values()].filter((n): n is number => typeof n === 'number' && n > 0)
  return valid.length ? round2(Math.min(...valid)) : product.priceAud ?? null
}

/** Changes that would write something to Payload. */
export const isWriteChange = (c: Change) => c.kind === 'update' || c.kind === 'verified' || c.kind === 'add' || (c.kind === 'stale' && c.drop)

export function summarise(plans: ProductPlan[]) {
  const count = (k: Change['kind']) => plans.reduce((n, p) => n + p.changes.filter((c) => c.kind === k).length, 0)
  return {
    products: plans.length,
    observed: plans.filter((p) => p.observed).length,
    updates: count('update'), verified: count('verified'), adds: count('add'), held: count('hold'),
    stale: count('stale'), staleDropped: plans.reduce((n, p) => n + p.changes.filter((c) => c.kind === 'stale' && c.drop).length, 0),
    skipped: count('skip'),
    productPriceChanges: plans.filter((p) => p.newPriceAud !== p.oldPriceAud).length,
  }
}

/**
 * Merge a patch into an existing sourceData value without dropping any existing key.
 * Returns null when the existing value is not an object (never replaced).
 */
export interface PricePoint { d: string; p: number }
export const HISTORY_DAYS = 90

/**
 * Adds today's price to an offer's sourceData.history: one point per Sydney calendar day (a second
 * check on the same day replaces the first), oldest first, capped at HISTORY_DAYS points.
 */
export function appendHistory(existing: unknown, price: number, nowIso: string): PricePoint[] {
  const day = new Date(nowIso).toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' })
  const prior = Array.isArray(existing)
    ? existing.filter((x): x is PricePoint => x && typeof x.d === 'string' && typeof x.p === 'number' && x.d !== day)
    : []
  return [...prior, { d: day, p: price }].sort((a, b) => a.d.localeCompare(b.d)).slice(-HISTORY_DAYS)
}

export function mergeSourceData(existing: unknown, patch: Record<string, unknown>): Record<string, unknown> | null {
  if (existing == null) return { ...patch }
  if (typeof existing !== 'object' || Array.isArray(existing)) return null
  const out: Record<string, unknown> = { ...(existing as Record<string, unknown>) }
  for (const [k, v] of Object.entries(patch)) if (v !== undefined) out[k] = v
  return out
}
