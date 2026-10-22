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
/** Condition words in a listing title (mostly eBay): never the new product the catalogue describes. */
const CONDITION_WORDS = ['faulty', 'broken', 'damaged', 'issue', 'issues', 'defective', 'cracked', 'untested', 'preowned', 'pre owned',
  'second hand', 'secondhand', 'open box', 'ex demo', 'demo', 'as is', 'not working', 'see description', 'read description', 'for parts']

const ECOSYSTEM_PHRASE = / (works with|compatible with|for) (amazon alexa|alexa|google home|google assistant|google|apple homekit|apple home|homekit|siri|smartthings|home assistant|matter)(?= )/g

/** Tokens that look like a model number: letters and digits together, or 3+ digits. */
export function modelTokens(name: string | null | undefined): string[] {
  return [...new Set(normalise(name).split(' ').filter((t) => (/[a-z]/.test(t) && /\d/.test(t)) || /^\d{3,}$/.test(t)))]
}

/**
 * Model tokens that also look like a model number but only describe a spec (resolution,
 * power, capacity, frequency, IP rating...): "2k", "1080p", "5ghz", "20w", "ip65", "wifi6".
 * They are attributes, not identity, so the link search leaves them out of its query and
 * does not require them in a candidate's title.
 */
const SPEC_TOKEN = /^(\d+(\.\d+)?(k|p|mp|w|kw|wh|kwh|v|a|mah|ah|gb|tb|mb|mm|cm|m|km|ft|in|inch|ghz|mhz|hz|g|kg|db|x|pcs|pc|pk|lm|l|ml|c|f|s|h|hr|hrs|yr|yrs|mins?|th|nd|rd|st|bit|fps|ch|way|gang|port|ports)|ip\d{2}|wifi\d|wi\d|h26\d|x\d+|\d+x|usb\d|ac\d{3,4}|ax\d{3,4}|n\d{3}|bt\d|ble\d|e27|e14|b22|gu10|gu5|mr16|cat\d[a-z]?)$/

/** The model tokens of a name that identify the product, without spec-like tokens. */
export function distinctiveModelTokens(name: string | null | undefined): string[] {
  return modelTokens(name).filter((t) => !SPEC_TOKEN.test(t))
}

/** Generic trailing words of a store/brand name ("eufy Security", "Arlo Official Store"). */
const BRAND_SUFFIXES = new Set(['security', 'home', 'smart', 'store', 'official', 'shop', 'technology', 'technologies', 'tech', 'electronics',
  'australia', 'au', 'inc', 'ltd', 'llc', 'co', 'pty', 'global', 'innovations', 'direct', 'brand', 'products', 'life', 'audio', 'lighting'])

/** The normalised brand plus, when the rest is only generic suffixes, its first word ("eufy security" → ["eufy security", "eufy"]). */
export function brandAliases(brand: string | null | undefined): string[] {
  const b = normalise(brand)
  if (!b) return []
  const words = b.split(' ')
  if (words.length > 1 && words[0].length >= 3 && words.slice(1).every((w) => BRAND_SUFFIXES.has(w))) return [b, words[0]]
  return [b]
}

export const normaliseGtin = (g: unknown) => {
  const s = String(g ?? '').replace(/\D/g, '')
  return s.length >= 8 ? s.replace(/^0+/, '') : ''
}

export interface IdentityInput { brand?: string | null; name: string; gtin?: string | null }
export interface CandidateInput { title: string; gtin?: string | null; brand?: string | null }
export interface IdentityResult { match: boolean; by?: 'gtin' | 'brand+model'; reason: string }
export interface IdentityOptions {
  /** Model tokens to require instead of modelTokens(product.name) (the link command passes the distinctive ones). */
  models?: string[]
}

export function identityMatch(product: IdentityInput, candidate: CandidateInput, opts: IdentityOptions = {}): IdentityResult {
  const pg = normaliseGtin(product.gtin), cg = normaliseGtin(candidate.gtin)
  if (pg && cg) return pg === cg ? { match: true, by: 'gtin', reason: `GTIN ${cg} matches` } : { match: false, reason: `GTIN differs (${cg} vs ${pg})` }

  // "Compatible with Alexa" / "for Google Home" describe the ecosystem, not an accessory.
  const title = ` ${normalise(candidate.title)} `.replace(ECOSYSTEM_PHRASE, ' ')
  const productWords = new Set(normalise(`${product.brand ?? ''} ${product.name}`).split(' '))
  const condition = CONDITION_WORDS.filter((w) => title.includes(` ${w} `))
  if (condition.length) return { match: false, reason: `listing condition word(s) in title: ${condition.join(', ')}` }
  const brands = brandAliases(product.brand)
  if (!brands.length) return { match: false, reason: 'product has no brand' }
  const brandHit = brands.some((b) => title.includes(` ${b} `)) || (candidate.brand ? brands.includes(normalise(candidate.brand)) : false)
  if (!brandHit) return { match: false, reason: `brand "${product.brand}" not in title` }

  const models = opts.models ?? modelTokens(product.name)
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
