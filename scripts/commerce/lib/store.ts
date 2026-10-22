/**
 * Payload reads and (only with --write) writes for the price tools.
 *
 * Every write passes context.skipRevalidation (product pages revalidate every 5 minutes on
 * their own) and merges into the existing sourceData JSON rather than replacing it.
 * Offers are never deleted or deactivated here.
 */
import type { Payload } from 'payload'
import type { Change, PlanOffer, PlanProduct, ProductPlan } from './plan'
import { appendHistory, mergeSourceData } from './plan'
import type { LinkResult } from './link'

export interface CatalogueProduct extends PlanProduct {
  brand: string | null
  active: boolean
  googleProductId: string | null
  gtin: string | null
  /** Model number from specifications / sourceData.productInformation (Amazon imports), if any. */
  modelNumber: string | null
}

export interface MerchantRow { id: number; name: string; active: boolean | null | undefined }

const context = { skipRevalidation: true }
const asObject = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {})
const idOf = (v: unknown): number => (typeof v === 'object' && v ? Number((v as { id: unknown }).id) : Number(v))

const GTIN_NAMES = ['gtin', 'gtin13', 'gtin 13', 'gtin-13', 'ean', 'upc', 'global trade identification number', 'barcode', 'isbn 13']
const MODEL_NAMES = ['item model number', 'model number', 'model', 'model name', 'manufacturer part number', 'part number', 'mpn']
const keyOf = (s: unknown) => String(s ?? '').toLowerCase().replace(/[\u200e\u200f:]/g, '').replace(/\s+/g, ' ').trim()

/** Name/value pairs from a specifications array ([{name, value}] or similar) or a plain object. */
function pairs(v: unknown): Array<[string, string]> {
  const out: Array<[string, string]> = []
  if (Array.isArray(v)) {
    for (const row of v) {
      if (!row || typeof row !== 'object') continue
      const r = row as Record<string, unknown>
      const name = r.name ?? r.title ?? r.label ?? r.specification_name ?? r.key
      const value = r.value ?? r.body ?? r.text ?? r.specification_value
      if (name != null && (typeof value === 'string' || typeof value === 'number')) out.push([keyOf(name), String(value).trim()])
    }
  } else if (v && typeof v === 'object') {
    for (const [k, value] of Object.entries(v)) if (typeof value === 'string' || typeof value === 'number') out.push([keyOf(k), String(value).trim()])
  }
  return out
}

/** First value for one of `names` across the given sources. */
export function specValue(sources: unknown[], names: string[]): string | null {
  for (const src of sources) for (const [k, v] of pairs(src)) if (names.includes(k) && v) return v
  return null
}

export async function loadMerchants(payload: Payload): Promise<MerchantRow[]> {
  const res = await payload.find({ collection: 'merchants', limit: 0, pagination: false, depth: 0, overrideAccess: true })
  return res.docs.map((m) => ({ id: m.id, name: m.name, active: m.active }))
}

export async function loadCatalogue(payload: Payload, merchants: MerchantRow[]): Promise<CatalogueProduct[]> {
  const [products, offers] = await Promise.all([
    payload.find({ collection: 'products', limit: 0, pagination: false, depth: 0, overrideAccess: true }),
    payload.find({ collection: 'offers', limit: 0, pagination: false, depth: 0, sort: 'order', overrideAccess: true }),
  ])
  const merchantName = new Map(merchants.map((m) => [m.id, m.name]))
  const byProduct = new Map<number, PlanOffer[]>()
  for (const o of offers.docs) {
    const pid = idOf(o.product)
    const mid = idOf(o.merchant)
    const list = byProduct.get(pid) ?? []
    list.push({
      id: o.id, merchantId: mid, merchantName: merchantName.get(mid) ?? `merchant #${mid}`, url: o.url,
      priceAud: typeof o.priceAud === 'number' ? o.priceAud : null, active: o.active !== false, deepLink: Boolean(o.deepLink),
      order: o.order ?? 0, sourceData: asObject(o.sourceData),
    })
    byProduct.set(pid, list)
  }
  return products.docs.map((p) => {
    const sd = asObject(p.sourceData)
    return {
      id: p.id, slug: p.slug, name: p.name, brand: p.brand ?? null, active: p.active !== false,
      googleProductId: p.googleProductId ? String(p.googleProductId) : null,
      gtin: typeof sd.gtin === 'string' || typeof sd.gtin === 'number' ? String(sd.gtin)
        : specValue([p.specifications, sd.productInformation, sd.details], GTIN_NAMES),
      modelNumber: specValue([p.specifications, sd.productInformation, sd.details], MODEL_NAMES),
      priceAud: typeof p.priceAud === 'number' ? p.priceAud : null, sourceData: sd, offers: byProduct.get(p.id) ?? [],
    }
  })
}

export interface WriteResult { offersUpdated: number; offersAdded: number; pricesCleared: number; productsUpdated: number; errors: string[] }

function offerPatch(c: Change, nowIso: string, existing: unknown): Record<string, unknown> {
  if (c.kind === 'update' || c.kind === 'verified') {
    const price = c.kind === 'update' ? c.newPrice : c.price
    const prior = existing && typeof existing === 'object' ? (existing as Record<string, unknown>).history : undefined
    const history = price != null ? { history: appendHistory(prior, price, nowIso) } : {}
    return c.verify
      // A ZenRows check of the offer's own page: record the verification; the price source changes only when the price did.
      ? { checkedAt: nowIso, verifiedAt: nowIso, verifiedPrice: price ?? undefined, availability: c.availability, ...history, ...(c.kind === 'update' ? { source: c.source } : {}) }
      : { checkedAt: nowIso, source: c.source, availability: c.availability, sellerTitle: c.sellerTitle, ...history }
  }
  return {}
}

export async function applyPlans(payload: Payload, plans: ProductPlan[], catalogue: CatalogueProduct[], now: Date): Promise<WriteResult> {
  const nowIso = now.toISOString()
  const out: WriteResult = { offersUpdated: 0, offersAdded: 0, pricesCleared: 0, productsUpdated: 0, errors: [] }
  const bySlug = new Map(catalogue.map((p) => [p.slug, p]))
  for (const plan of plans) {
    const product = bySlug.get(plan.slug)
    if (!product) continue
    let wrote = false
    for (const c of plan.changes) {
      try {
        if (c.kind === 'update' || c.kind === 'verified') {
          const fresh = await payload.findByID({ collection: 'offers', id: c.offerId, depth: 0, overrideAccess: true })
          const sourceData = mergeSourceData(fresh.sourceData, offerPatch(c, nowIso, fresh.sourceData))
          if (!sourceData) { out.errors.push(`offer #${c.offerId}: sourceData is not an object; left alone`); continue }
          const data: Record<string, unknown> = { sourceData }
          if (c.kind === 'update') {
            if (c.newPrice != null) data.priceAud = c.newPrice
            if (c.newUrl) { data.url = c.newUrl; data.deepLink = true }
          }
          await payload.update({ collection: 'offers', id: c.offerId, data, depth: 0, overrideAccess: true, context })
          out.offersUpdated++; wrote = true
        } else if (c.kind === 'add') {
          await payload.create({
            collection: 'offers', depth: 0, overrideAccess: true, context,
            data: {
              label: `${product.name} — ${c.retailer}`, product: product.id, merchant: c.merchantId, url: c.url, priceAud: c.price,
              primary: false, deepLink: true, active: true, order: c.order,
              sourceData: { checkedAt: nowIso, source: c.source, availability: c.availability, sellerTitle: c.sellerTitle, history: appendHistory(undefined, c.price, nowIso),
                ...(c.source === 'zenrows' ? { verifiedAt: nowIso, verifiedPrice: c.price } : {}) },
            },
          })
          out.offersAdded++; wrote = true
        } else if (c.kind === 'stale' && c.drop) {
          const fresh = await payload.findByID({ collection: 'offers', id: c.offerId, depth: 0, overrideAccess: true })
          const sourceData = mergeSourceData(fresh.sourceData, { staleClearedAt: nowIso, clearedPriceAud: c.price })
          if (!sourceData) { out.errors.push(`offer #${c.offerId}: sourceData is not an object; left alone`); continue }
          await payload.update({ collection: 'offers', id: c.offerId, data: { priceAud: null, sourceData }, depth: 0, overrideAccess: true, context })
          out.pricesCleared++; wrote = true
        }
      } catch (e) {
        out.errors.push(`${plan.slug} ${c.kind} ${'retailer' in c ? c.retailer : ''}: ${(e as Error).message}`)
      }
    }
    if (!wrote && !plan.observed) continue
    try {
      const fresh = await payload.findByID({ collection: 'products', id: product.id, depth: 0, overrideAccess: true })
      const sourceData = mergeSourceData(fresh.sourceData, { pricesCheckedAt: nowIso })
      const data: Record<string, unknown> = {}
      if (sourceData) data.sourceData = sourceData
      else out.errors.push(`${plan.slug}: product sourceData is not an object; pricesCheckedAt not recorded`)
      // Recomputed from the offers as they now stand in the database, not from the plan.
      const offers = await payload.find({ collection: 'offers', where: { and: [{ product: { equals: product.id } }, { active: { equals: true } }] }, limit: 0, pagination: false, depth: 0, overrideAccess: true })
      const prices = offers.docs.map((o) => o.priceAud).filter((n): n is number => typeof n === 'number' && n > 0)
      const min = prices.length ? Math.min(...prices) : null
      if (min != null && min !== fresh.priceAud) data.priceAud = min
      if (Object.keys(data).length) {
        await payload.update({ collection: 'products', id: product.id, data, depth: 0, overrideAccess: true, context })
        out.productsUpdated++
      }
    } catch (e) {
      out.errors.push(`${plan.slug} product: ${(e as Error).message}`)
    }
  }
  return out
}

export interface LinkWriteResult { linked: number; errors: string[] }

/**
 * Records sourceData.linkAttemptedAt on products a `refresh` link search did not match, so
 * the daily refresh retries them weekly instead of paying for the same search every day.
 */
export async function recordLinkAttempts(payload: Payload, results: LinkResult[], now: Date): Promise<string[]> {
  const errors: string[] = []
  for (const r of results) {
    if (r.status === 'matched' || r.status === 'not-searched' || r.status === 'error') continue
    try {
      const fresh = await payload.findByID({ collection: 'products', id: r.productId, depth: 0, overrideAccess: true })
      const sourceData = mergeSourceData(fresh.sourceData, { linkAttemptedAt: now.toISOString(), linkAttemptStatus: r.status })
      if (!sourceData) { errors.push(`${r.slug}: product sourceData is not an object; attempt not recorded`); continue }
      await payload.update({ collection: 'products', id: r.productId, data: { sourceData }, depth: 0, overrideAccess: true, context })
    } catch (e) {
      errors.push(`${r.slug} link attempt: ${(e as Error).message}`)
    }
  }
  return errors
}

/**
 * Writes googleProductId (and sourceData.googleLink, merged into the existing sourceData) for
 * MATCHED link results only. Nothing else on the product is sent. A product that gained a
 * googleProductId since it was read is left alone.
 */
export async function applyLinks(payload: Payload, results: LinkResult[], now: Date): Promise<LinkWriteResult> {
  const out: LinkWriteResult = { linked: 0, errors: [] }
  for (const r of results) {
    if (r.status !== 'matched' || !r.googleProductId) continue
    try {
      const fresh = await payload.findByID({ collection: 'products', id: r.productId, depth: 0, overrideAccess: true })
      if (fresh.googleProductId) { out.errors.push(`${r.slug}: already has googleProductId ${fresh.googleProductId}; not changed`); continue }
      const sourceData = mergeSourceData(fresh.sourceData, {
        googleLink: { matchedAt: now.toISOString(), title: r.title, reason: r.reason, query: r.query, confidence: r.confidence, by: r.by },
      })
      if (!sourceData) { out.errors.push(`${r.slug}: product sourceData is not an object; not linked`); continue }
      await payload.update({ collection: 'products', id: r.productId, data: { googleProductId: r.googleProductId, sourceData }, depth: 0, overrideAccess: true, context })
      r.written = true
      out.linked++
    } catch (e) {
      out.errors.push(`${r.slug} link: ${(e as Error).message}`)
    }
  }
  return out
}
