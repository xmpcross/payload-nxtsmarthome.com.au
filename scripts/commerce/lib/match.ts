/**
 * Product identity matching (pure). Used to decide whether a retailer search result or a
 * Google Shopping candidate is the same product as a catalogue entry.
 *
 * Deliberately conservative: a match needs the brand AND every model token (a word with
 * both letters and digits, e.g. "M100", "AC2A", "C1"), or an identical GTIN. A product
 * name with no model token can only be matched by GTIN. Variant and accessory words in
 * the candidate that the product does not have ("Pro", "Mini", "Filter") block a match.
 */

export const normalise = (s: string | null | undefined) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

const VARIANT_WORDS = ['pro', 'plus', 'max', 'mini', 'lite', 'ultra', 'air', 'xl', 'se', 'gen', 'generation', 'kit', 'bundle', 'pack']
const ACCESSORY_WORDS = ['filter', 'filters', 'replacement', 'case', 'cover', 'mount', 'bracket', 'charger', 'cable', 'adapter', 'adaptor',
  'skin', 'stand', 'refurbished', 'renewed', 'used', 'spare', 'parts', 'compatible', 'for']

/** Tokens that look like a model number: letters and digits together, or 3+ digits. */
export function modelTokens(name: string | null | undefined): string[] {
  return [...new Set(normalise(name).split(' ').filter((t) => (/[a-z]/.test(t) && /\d/.test(t)) || /^\d{3,}$/.test(t)))]
}

export const normaliseGtin = (g: unknown) => {
  const s = String(g ?? '').replace(/\D/g, '')
  return s.length >= 8 ? s.replace(/^0+/, '') : ''
}

export interface IdentityInput { brand?: string | null; name: string; gtin?: string | null }
export interface CandidateInput { title: string; gtin?: string | null; brand?: string | null }
export interface IdentityResult { match: boolean; by?: 'gtin' | 'brand+model'; reason: string }

export function identityMatch(product: IdentityInput, candidate: CandidateInput): IdentityResult {
  const pg = normaliseGtin(product.gtin), cg = normaliseGtin(candidate.gtin)
  if (pg && cg) return pg === cg ? { match: true, by: 'gtin', reason: `GTIN ${cg} matches` } : { match: false, reason: `GTIN differs (${cg} vs ${pg})` }

  const title = ` ${normalise(candidate.title)} `
  const productWords = new Set(normalise(`${product.brand ?? ''} ${product.name}`).split(' '))
  const brand = normalise(product.brand)
  if (!brand) return { match: false, reason: 'product has no brand' }
  const brandHit = title.includes(` ${brand} `) || (candidate.brand ? normalise(candidate.brand) === brand : false)
  if (!brandHit) return { match: false, reason: `brand "${product.brand}" not in title` }

  const models = modelTokens(product.name)
  if (!models.length) return { match: false, reason: 'no model number in product name; needs a GTIN to match' }
  const missing = models.filter((m) => !title.includes(` ${m} `))
  if (missing.length) return { match: false, reason: `model ${missing.join(', ')} not in title` }

  const extra = [...VARIANT_WORDS, ...ACCESSORY_WORDS].filter((w) => title.includes(` ${w} `) && !productWords.has(w))
  if (extra.length) return { match: false, reason: `variant/accessory word(s) in title: ${extra.join(', ')}` }
  return { match: true, by: 'brand+model', reason: `brand + model ${models.join(', ')} match` }
}

export interface CatalogueEntry { id: number; slug: string; brand?: string | null; name: string; googleProductId?: string | null }

/** Whether a Google Shopping candidate is already in the catalogue: by googleProductId, then normalised brand+name, then brand+model. */
export function findInCatalogue(candidate: { productId?: string | null; title: string; brand?: string | null }, catalogue: CatalogueEntry[]) {
  if (candidate.productId) {
    const hit = catalogue.find((p) => p.googleProductId && String(p.googleProductId) === String(candidate.productId))
    if (hit) return { slug: hit.slug, by: 'googleProductId' as const }
  }
  const t = normalise(candidate.title)
  const byName = catalogue.find((p) => normalise(`${p.brand ?? ''} ${p.name}`) === t || normalise(p.name) === t)
  if (byName) return { slug: byName.slug, by: 'name' as const }
  const byModel = catalogue.find((p) => identityMatch(p, { title: candidate.title, brand: candidate.brand }).match)
  if (byModel) return { slug: byModel.slug, by: 'brand+model' as const }
  return null
}
