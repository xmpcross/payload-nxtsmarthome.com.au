/**
 * `prices.sh fill` decisions (pure): pick the retailer product page that replaces an offer
 * linking to a search-results page, from DataForSEO Amazon search or Google `site:` results.
 *
 * Identity is decided by identityMatch with the product's distinctive model tokens, exactly
 * as `link` does: brand + every distinctive model token, no variant/accessory/condition word.
 * A product with no distinctive model token (e.g. "HomePod (2nd Generation)") is not matched.
 */
import { hostAllowed, type AuRetailer } from './au-retailers'
import type { DfsAmazonItem, DfsOrganicItem } from './dataforseo'
import { brandAliases, distinctiveModelTokens, identityMatch, normalise, type IdentityInput, type IdentityResult } from './match'
import { isSearchUrl } from './plan'

export interface FillOption { title: string; url: string; price: number | null; id: IdentityResult }

/**
 * Amazon search titles sometimes leave the brand out (it is shown on its own line); the
 * listing URL slug starts with it ("/Aqara-Automation-.../dp/..."). Put it back in front of
 * the title only in that case, so the brand is still required.
 */
export function amazonTitle(item: DfsAmazonItem, brand: string | null | undefined): string {
  const title = (item.title ?? '').trim()
  let slug = ''
  try { slug = normalise(decodeURIComponent(new URL(item.url ?? '').pathname.split('/dp/')[0])) } catch { /* no usable URL */ }
  const lead = brandAliases(brand).find((b) => slug === b || slug.startsWith(`${b} `))
  return lead && !` ${normalise(title)} `.includes(` ${lead} `) ? `${brand} ${title}`.trim() : title
}

/** "Aqara Hub M3 | JB Hi-Fi" → "Aqara Hub M3": the retailer suffix of a Google result title. */
export const organicTitle = (title: string | null | undefined) => (title ?? '').replace(/\s+[|–—-]\s+[^|–—-]+$/, '').trim()

/** Product pages among the results, each with its identity verdict; the first match is `hit`. */
export function pickProductPage(product: IdentityInput, retailer: AuRetailer, items: Array<DfsAmazonItem | DfsOrganicItem>, amazon: boolean) {
  const models = distinctiveModelTokens(product.name)
  const options: FillOption[] = []
  const seen = new Set<string>()
  for (const it of items) {
    if (!it.url || !retailer.productPath || !hostAllowed(retailer, it.url) || isSearchUrl(it.url)) continue
    let pathname: string
    try { pathname = new URL(it.url).pathname } catch { continue }
    if (!retailer.productPath.test(pathname)) continue
    const a = it as DfsAmazonItem
    const asin = amazon ? a.data_asin ?? pathname.match(/\/dp\/([A-Z0-9]{10})/)?.[1] : null
    const url = asin ? `https://www.amazon.com.au/dp/${asin}` : it.url.replace(/[?#].*$/, '')
    if (seen.has(url)) continue
    seen.add(url)
    const title = amazon ? amazonTitle(a, product.brand) : organicTitle(it.title)
    const price = amazon && typeof a.price_from === 'number' && a.price_from > 0 && (!a.currency || a.currency === 'AUD') ? a.price_from : null
    options.push({ title, url, price, id: identityMatch(product, { title }, { models }) })
  }
  return { hit: options.find((o) => o.id.match), options }
}
