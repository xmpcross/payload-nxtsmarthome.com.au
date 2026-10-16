/**
 * Price extraction from retailer HTML (pure, no DOM dependency).
 *
 * Order of preference:
 *   1. JSON-LD Product → offers (Offer / AggregateOffer / priceSpecification)
 *   2. Meta tags: product:price:amount, og:price:amount, itemprop="price"
 *   3. Retailer-specific selectors (Amazon a-offscreen, eBay x-price-primary, …)
 * A price stated in a currency other than AUD is rejected, never converted.
 */

export type PriceMethod = 'json-ld' | 'meta' | 'selector'

export interface PriceExtraction {
  price: number | null
  method: PriceMethod | null
  currency?: string
  availability?: 'in_stock' | 'out_of_stock' | 'preorder' | 'unknown'
  title?: string
  brand?: string
  gtin?: string
  sku?: string
  /** Why no price was returned, when it was not. */
  reason?: string
}

const round2 = (n: number) => Math.round(n * 100) / 100

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'", '#x27': "'", '#36': '$' }
export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    const k = e.toLowerCase()
    if (ENTITIES[k] !== undefined) return ENTITIES[k]
    if (k.startsWith('#x')) return String.fromCodePoint(parseInt(k.slice(2), 16))
    if (k.startsWith('#')) return String.fromCodePoint(parseInt(k.slice(1), 10))
    return m
  })
}

export const stripTags = (s: string) => decodeEntities(s.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()

/**
 * Parse an Australian-dollar amount. Accepts "$1,299.00", "AU $67.11", "A$49", "AUD 49.95",
 * "349", 349.5. Rejects other currencies (US$, USD, €, £), ranges and anything implausible.
 */
export function parseAud(input: unknown): number | null {
  if (typeof input === 'number') return Number.isFinite(input) && input > 0 && input < 100000 ? round2(input) : null
  if (typeof input !== 'string') return null
  let s = decodeEntities(input).replace(/\u00a0/g, ' ').trim()
  if (!s) return null
  if (/\b(US|USD|NZ|NZD|CAD|EUR|GBP)\b|US\$|NZ\$|C\$|€|£|¥/i.test(s)) return null
  // A range ("$49 - $59", "$49 to $59") is not a single price.
  if (/\d\s*(-|–|to)\s*(A?U?\$|AUD)?\s*\d/i.test(s.replace(/^\s*-/, ''))) return null
  s = s.replace(/\b(AUD|AU|A)\b/gi, '').replace(/\$/g, '').replace(/^(from|now|only|price:?)\s*/i, '').trim()
  const m = s.match(/^\D{0,3}?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?(?!\d)/)
  if (!m) return null
  const n = Number(`${m[1].replace(/,/g, '')}${m[2] ? `.${m[2]}` : ''}`)
  return Number.isFinite(n) && n > 0 && n < 100000 ? round2(n) : null
}

const SCHEMA_AVAILABILITY: Array<[RegExp, PriceExtraction['availability']]> = [
  [/instock|limitedavailability|onlineonly|instoreonly/i, 'in_stock'],
  [/outofstock|soldout|discontinued/i, 'out_of_stock'],
  [/preorder|presale|backorder/i, 'preorder'],
]
export function normaliseAvailability(v: unknown): PriceExtraction['availability'] {
  const s = String(v ?? '').replace(/[\s_-]+/g, '')
  if (!s) return undefined
  return SCHEMA_AVAILABILITY.find(([re]) => re.test(s))?.[1] ?? 'unknown'
}

/** All parseable JSON-LD blocks, flattened (arrays and @graph). */
export function jsonLdNodes(html: string): any[] {
  const out: any[] = []
  const re = /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  for (const m of html.matchAll(re)) {
    let raw = m[1].trim().replace(/^<!--|-->$/g, '').trim()
    let data: any
    try { data = JSON.parse(raw) } catch {
      try { raw = raw.replace(/[\u0000-\u001f]+/g, ' '); data = JSON.parse(raw) } catch { continue }
    }
    const walk = (node: any) => {
      if (!node || typeof node !== 'object') return
      if (Array.isArray(node)) { node.forEach(walk); return }
      out.push(node)
      if (node['@graph']) walk(node['@graph'])
    }
    walk(data)
  }
  return out
}

const hasType = (node: any, type: string) => {
  const t = node?.['@type']
  return Array.isArray(t) ? t.some((x) => String(x).toLowerCase() === type.toLowerCase()) : String(t ?? '').toLowerCase() === type.toLowerCase()
}

const textOf = (v: any): string | undefined => {
  if (v == null) return undefined
  if (typeof v === 'string' || typeof v === 'number') return String(v)
  if (typeof v === 'object' && v.name) return String(v.name)
  return undefined
}

function fromJsonLd(html: string): PriceExtraction | null {
  const products = jsonLdNodes(html).filter((n) => hasType(n, 'Product') || hasType(n, 'ProductGroup'))
  let rejected: string | undefined
  for (const p of products) {
    const offers = ([] as any[]).concat(p.offers ?? [], p.hasVariant?.flatMap?.((v: any) => [].concat(v.offers ?? [])) ?? [])
    for (const o of offers) {
      if (!o || typeof o !== 'object') continue
      const spec = Array.isArray(o.priceSpecification) ? o.priceSpecification[0] : o.priceSpecification
      const currency = String(o.priceCurrency ?? spec?.priceCurrency ?? '').toUpperCase() || undefined
      if (currency && currency !== 'AUD') { rejected = `JSON-LD price is in ${currency}`; continue }
      const raw = o.price ?? spec?.price ?? (hasType(o, 'AggregateOffer') ? o.lowPrice : undefined)
      const price = parseAud(typeof raw === 'number' ? raw : String(raw ?? ''))
      if (price == null) continue
      return {
        price, method: 'json-ld', currency: currency ?? 'AUD', availability: normaliseAvailability(o.availability),
        title: textOf(p.name), brand: textOf(p.brand), sku: textOf(p.sku) ?? textOf(p.mpn),
        gtin: textOf(p.gtin13 ?? p.gtin ?? p.gtin14 ?? p.gtin12 ?? p.gtin8 ?? o.gtin13 ?? o.gtin),
      }
    }
  }
  return rejected ? { price: null, method: null, reason: rejected } : null
}

/** Attribute value of the first tag matching `tagRe` that also has `attr`. */
function metaContent(html: string, keyAttr: 'property' | 'name' | 'itemprop', key: string): string | undefined {
  const re = new RegExp(`<(?:meta|span|div|link)\\b[^>]*\\b${keyAttr}\\s*=\\s*["']${key.replace(/[.:]/g, '\\$&')}["'][^>]*>`, 'i')
  const tag = html.match(re)?.[0]
  if (!tag) return undefined
  return tag.match(/\bcontent\s*=\s*["']([^"']*)["']/i)?.[1] ?? tag.match(/\bhref\s*=\s*["']([^"']*)["']/i)?.[1]
}

function fromMeta(html: string): PriceExtraction | null {
  const currency = (metaContent(html, 'property', 'product:price:currency') ?? metaContent(html, 'property', 'og:price:currency')
    ?? metaContent(html, 'itemprop', 'priceCurrency'))?.toUpperCase()
  if (currency && currency !== 'AUD') return { price: null, method: null, reason: `meta price is in ${currency}` }
  for (const [attr, key] of [['property', 'product:price:amount'], ['property', 'og:price:amount'], ['itemprop', 'price']] as const) {
    const raw = metaContent(html, attr, key)
    const price = parseAud(raw)
    if (price != null) {
      return {
        price, method: 'meta', currency: currency ?? 'AUD',
        availability: normaliseAvailability(metaContent(html, 'property', 'product:availability') ?? metaContent(html, 'property', 'og:availability') ?? metaContent(html, 'itemprop', 'availability')),
        title: metaContent(html, 'property', 'og:title'),
        brand: metaContent(html, 'property', 'product:brand') ?? metaContent(html, 'itemprop', 'brand'),
        gtin: metaContent(html, 'itemprop', 'gtin13') ?? metaContent(html, 'property', 'product:ean'),
      }
    }
  }
  return null
}

/** Inner text of the first element whose opening tag matches `openRe`. */
function firstText(html: string, openRe: RegExp, maxLen = 400): string | undefined {
  const m = openRe.exec(html)
  if (!m) return undefined
  return stripTags(html.slice(m.index + m[0].length, m.index + m[0].length + maxLen).split(/<\/(?:span|div|p|h\d|strong)>/i)[0])
}

const SELECTORS: Record<string, RegExp[]> = {
  'Amazon AU': [/<span[^>]*class="[^"]*\ba-offscreen\b[^"]*"[^>]*>/i, /<span[^>]*id="priceblock_ourprice"[^>]*>/i],
  'eBay AU': [/<div[^>]*class="[^"]*\bx-price-primary\b[^"]*"[^>]*>\s*<span[^>]*>/i],
  'JB Hi-Fi': [/<span[^>]*class="[^"]*\bPriceTag_actual[^"]*"[^>]*>/i, /<[^>]*data-testid="ticket-price"[^>]*>/i],
  'The Good Guys': [/<[^>]*class="[^"]*\bpricepoint-price\b[^"]*"[^>]*>/i, /<[^>]*data-testid="product-price"[^>]*>/i],
  'Harvey Norman': [/<span[^>]*class="[^"]*\bprice\b[^"]*"[^>]*>/i],
  'Bunnings': [/<[^>]*data-locator="product-price"[^>]*>/i],
}

function fromSelectors(html: string, retailer?: string): PriceExtraction | null {
  const res = retailer ? SELECTORS[retailer] ?? [] : Object.values(SELECTORS).flat()
  for (const re of res) {
    const text = firstText(html, re)
    // Split prices like "$49<sup>.95</sup>" have been flattened to "$49 .95" by stripTags.
    const price = parseAud(text?.replace(/(\d)\s+\.(\d{2})\b/, '$1.$2'))
    if (price != null) return { price, method: 'selector', currency: 'AUD', title: firstText(html, /<title[^>]*>/i, 300) }
  }
  return null
}

export function extractPrice(html: string, retailer?: string): PriceExtraction {
  if (!html || typeof html !== 'string') return { price: null, method: null, reason: 'empty page' }
  const ld = fromJsonLd(html)
  if (ld?.price != null) return ld
  // The page states its price in another currency: do not fall back to weaker signals.
  if (ld?.reason) return ld
  const meta = fromMeta(html)
  if (meta?.price != null || meta?.reason) return meta!
  const sel = fromSelectors(html, retailer)
  if (sel) return sel
  return { price: null, method: null, reason: ld?.reason ?? meta?.reason ?? 'no JSON-LD, meta or selector price found' }
}

export interface SearchResult { title: string; url: string }

/**
 * Product links from a retailer search page: JSON-LD ItemList entries first, then anchors
 * whose path matches the retailer's product-path pattern. Titles come from the anchor's
 * aria-label/title attribute or its text.
 */
export function extractSearchResults(html: string, baseUrl: string, productPath: RegExp, max = 10): SearchResult[] {
  const seen = new Set<string>()
  const out: SearchResult[] = []
  const add = (title: string | undefined, href: string | undefined) => {
    if (!title || !href) return
    let url: URL
    try { url = new URL(decodeEntities(href), baseUrl) } catch { return }
    if (!productPath.test(url.pathname)) return
    const key = `${url.hostname}${url.pathname}`
    const clean = stripTags(title)
    if (!clean || clean.length < 4 || seen.has(key)) return
    seen.add(key)
    out.push({ title: clean, url: url.toString() })
  }
  for (const node of jsonLdNodes(html)) {
    if (!hasType(node, 'ItemList')) continue
    for (const el of [].concat(node.itemListElement ?? []) as any[]) {
      const item = el?.item && typeof el.item === 'object' ? el.item : el
      add(textOf(item?.name), item?.url ?? el?.url)
    }
  }
  for (const m of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const attrs = m[1]
    const href = attrs.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1]
    const label = attrs.match(/\b(?:aria-label|title)\s*=\s*["']([^"']+)["']/i)?.[1]
    add(label ?? m[2], href)
    if (out.length >= max) break
  }
  return out.slice(0, max)
}
