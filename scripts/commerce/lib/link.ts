/**
 * Linking a catalogue product to its Google Shopping product id (pure).
 *
 * The `link` command runs one Google Shopping search per product that has no
 * googleProductId, then picks the result that is the same product:
 *
 *   - Identity uses lib/match.ts identityMatch: an identical GTIN, or the brand plus every
 *     distinctive model token (spec-like tokens such as "2k" or "1080p" are not required),
 *     with no variant/accessory word the product does not have.
 *   - MATCHED: every matching result points at ONE Google product id. When the only model
 *     tokens are short (e.g. "c1"), most of the product name's words must appear too.
 *   - AMBIGUOUS: several distinct product ids match, or a short-token match is not backed
 *     by the rest of the name, or the id is already linked to another product.
 *   - NO MATCH: nothing matches (the closest titles and why they failed are reported).
 *
 * Only MATCHED results are ever written, and only googleProductId plus
 * sourceData.googleLink.
 */
import type { DfsShoppingItem } from './dataforseo'
import { brandAliases, distinctiveModelTokens, identityMatch, modelTokens, normalise, type IdentityResult } from './match'

export interface LinkProduct {
  id: number
  slug: string
  name: string
  brand: string | null
  gtin: string | null
  /** Model number from the product's specifications/source data, used when the name has none. */
  modelNumber?: string | null
}

export type LinkStatus = 'matched' | 'ambiguous' | 'no-match' | 'error' | 'not-searched'

export interface LinkCandidate {
  rank: number
  title: string
  productId: string | null
  price: number | null
  seller: string | null
  match: boolean
  by?: IdentityResult['by']
  reason: string
}

export interface LinkResult {
  productId: number
  slug: string
  name: string
  brand: string | null
  query: string
  status: LinkStatus
  googleProductId?: string
  title?: string
  by?: IdentityResult['by']
  confidence?: 'high' | 'medium'
  reason: string
  candidates: LinkCandidate[]
  written?: boolean
}

/** The model tokens identity is checked against: distinctive tokens of the name, else of the spec model number. */
export function linkModels(p: LinkProduct): string[] {
  const fromName = distinctiveModelTokens(p.name)
  if (fromName.length) return fromName
  return distinctiveModelTokens(p.modelNumber)
}

/** Search query: brand + distinctive model tokens; the brand + product name when there are none. */
export function linkQuery(p: LinkProduct): string {
  const brand = brandAliases(p.brand).at(-1) ?? ''
  const models = linkModels(p)
  if (models.length) return `${brand} ${models.join(' ')}`.trim()
  const name = normalise(p.name).split(' ').slice(0, 10).join(' ')
  const nameHasBrand = brand && ` ${normalise(p.name)} `.includes(` ${brand} `)
  return `${nameHasBrand ? '' : brand} ${name}`.trim()
}

/** Share of the product name's words (excluding the brand and the model tokens) that the title contains. */
function nameCoverage(p: LinkProduct, title: string): number {
  const t = ` ${normalise(title)} `
  const skip = new Set([...brandAliases(p.brand).flatMap((b) => b.split(' ')), ...modelTokens(p.name)])
  const words = normalise(p.name).split(' ').filter((w) => w.length > 1 && !skip.has(w))
  if (!words.length) return 1
  return words.filter((w) => t.includes(` ${w} `)).length / words.length
}

const SHORT_MODEL = 3
const MIN_COVERAGE = 0.6

export function chooseLink(p: LinkProduct, items: DfsShoppingItem[] | null, opts: { linkedIds?: Map<string, string>; query?: string } = {}): LinkResult {
  const query = opts.query ?? linkQuery(p)
  const base = { productId: p.id, slug: p.slug, name: p.name, brand: p.brand, query }
  const models = linkModels(p)
  const identity = { brand: p.brand, name: models.length && !distinctiveModelTokens(p.name).length ? `${p.name} ${models.join(' ')}` : p.name, gtin: p.gtin }

  // One entry per Google product (or per listing without one), best rank first.
  const seen = new Set<string>()
  const candidates: LinkCandidate[] = []
  for (const it of [...(items ?? [])].sort((a, b) => (a.rank_absolute ?? 999) - (b.rank_absolute ?? 999))) {
    if (!it.title) continue
    const key = it.product_id ? `pid:${it.product_id}` : `t:${normalise(it.title)}`
    if (seen.has(key)) continue
    seen.add(key)
    const id = identityMatch(identity, { title: it.title, gtin: (it as { gtin?: string | null }).gtin ?? null }, { models })
    candidates.push({
      rank: candidates.length + 1, title: it.title.trim(), productId: it.product_id ? String(it.product_id) : null,
      price: typeof it.price === 'number' ? it.price : null, seller: it.seller ?? null, match: id.match, by: id.by, reason: id.reason,
    })
  }
  const top = (list: LinkCandidate[]) => list.slice(0, 5)

  if (!items?.length) return { ...base, status: 'no-match', reason: 'the search returned no results', candidates: [] }
  const matched = candidates.filter((c) => c.match)
  const withId = matched.filter((c) => c.productId)
  if (!matched.length) {
    const why = !p.brand ? 'product has no brand' : !models.length && !p.gtin ? 'no model number in the name or specifications, and no GTIN: nothing can confirm identity' : 'no result has the same brand + model (or GTIN)'
    return { ...base, status: 'no-match', reason: why, candidates: top(candidates) }
  }
  if (!withId.length) return { ...base, status: 'no-match', reason: 'matching listing(s) have no Google product id, so they cannot be linked', candidates: top(matched) }

  const ids = [...new Set(withId.map((c) => c.productId!))]
  if (ids.length > 1) {
    return { ...base, status: 'ambiguous', reason: `${ids.length} different Google products match (${ids.join(', ')}); pick one by hand`, candidates: top(withId) }
  }
  const hit = withId[0]
  const by = hit.by
  const other = opts.linkedIds?.get(hit.productId!)
  if (other && other !== p.slug) {
    return { ...base, status: 'ambiguous', reason: `Google product ${hit.productId} is already linked to ${other}`, candidates: top(withId) }
  }
  let confidence: 'high' | 'medium' = 'high'
  let reason = hit.reason
  if (by !== 'gtin') {
    const coverage = nameCoverage(p, hit.title)
    const short = models.every((m) => m.length < SHORT_MODEL)
    if (short && coverage < MIN_COVERAGE) {
      return { ...base, status: 'ambiguous', reason: `only a short model number (${models.join(', ')}) matches and ${Math.round(coverage * 100)}% of the name's words are in the title`, candidates: top(withId) }
    }
    if (short || coverage < MIN_COVERAGE) confidence = 'medium'
    reason = `${hit.reason}; ${Math.round(coverage * 100)}% of the name's other words in the title`
  }
  return { ...base, status: 'matched', googleProductId: hit.productId!, title: hit.title, by, confidence, reason, candidates: top(candidates) }
}

export function summariseLinks(results: LinkResult[]) {
  const n = (s: LinkStatus) => results.filter((r) => r.status === s).length
  return { products: results.length, matched: n('matched'), ambiguous: n('ambiguous'), noMatch: n('no-match'), errors: n('error'), notSearched: n('not-searched'), written: results.filter((r) => r.written).length }
}
