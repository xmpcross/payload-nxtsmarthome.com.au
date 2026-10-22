/**
 * The single shared list of Australian retailers the price tools recognise.
 *
 * Ported from scripts/refresh-prices.mjs / add-products-min-offers.mjs (same 16 retailers,
 * same grey-market exclusions) and extended with the merchants that already exist in
 * Payload. Every retailer carries a host allow-list: a seller whose name matches but whose
 * URL points elsewhere (e.g. "Amazon.com" on amazon.com, not amazon.com.au) is rejected.
 *
 * `name` is the Payload Merchant name. Merchants are looked up by that name at runtime;
 * a retailer with no Merchant record is reported and skipped, never created.
 */

export interface ZenRowsProfile {
  /** Retailer search page for a free-text query. */
  search: (query: string) => string
  /** Path pattern of a product page on this retailer, used to pick links off a search page. */
  productPath: RegExp
  /** Whether the page needs a headless browser (more ZenRows credits). */
  jsRender: boolean
  /** Milliseconds ZenRows waits after rendering a search page (results load late). */
  searchWaitMs?: number
}

export interface AuRetailer {
  /** Payload Merchant name. */
  name: string
  /** Lower-case substrings matched against the DataForSEO seller title. */
  patterns: string[]
  /** Hostnames (and their subdomains) a product URL for this retailer may use. */
  hosts: string[]
  /** Present when ZenRows verification / gap filling is supported for this retailer. */
  zenrows?: ZenRowsProfile
}

const q = (s: string) => encodeURIComponent(s)

export const AU_RETAILERS: AuRetailer[] = [
  { name: 'JB Hi-Fi', patterns: ['jb hi-fi', 'jbhifi', 'jb hifi'], hosts: ['jbhifi.com.au'],
    zenrows: { search: (s) => `https://www.jbhifi.com.au/search?query=${q(s)}`, productPath: /\/products\/[a-z0-9-]+/i, jsRender: true, searchWaitMs: 6000 } },
  { name: 'The Good Guys', patterns: ['good guys'], hosts: ['thegoodguys.com.au'],
    zenrows: { search: (s) => `https://www.thegoodguys.com.au/SearchDisplay?searchTerm=${q(s)}`, productPath: /^\/[a-z0-9-]+-[a-z0-9]+$/i, jsRender: true } },
  { name: 'Harvey Norman', patterns: ['harvey norman'], hosts: ['harveynorman.com.au'],
    zenrows: { search: (s) => `https://www.harveynorman.com.au/catalogsearch/result/?q=${q(s)}`, productPath: /\/[a-z0-9-]+\.html$/i, jsRender: true } },
  { name: 'Officeworks', patterns: ['officeworks'], hosts: ['officeworks.com.au'] },
  { name: 'Bunnings', patterns: ['bunnings'], hosts: ['bunnings.com.au'],
    zenrows: { search: (s) => `https://www.bunnings.com.au/search/products?q=${q(s)}`, productPath: /_p\d+/i, jsRender: true } },
  { name: 'Bing Lee', patterns: ['bing lee', 'binglee'], hosts: ['binglee.com.au'] },
  { name: 'Kogan AU', patterns: ['kogan'], hosts: ['kogan.com'] },
  { name: 'Scorptec', patterns: ['scorptec'], hosts: ['scorptec.com.au'] },
  { name: 'Mwave', patterns: ['mwave'], hosts: ['mwave.com.au'] },
  { name: 'Woolworths', patterns: ['woolworths'], hosts: ['woolworths.com.au'] },
  { name: 'BIG W', patterns: ['big w'], hosts: ['bigw.com.au'] },
  { name: 'Kmart', patterns: ['kmart'], hosts: ['kmart.com.au'] },
  { name: 'Costco AU', patterns: ['costco'], hosts: ['costco.com.au'] },
  { name: 'Appliances Online', patterns: ['appliances online', 'appliancesonline'], hosts: ['appliancesonline.com.au'] },
  { name: 'Amazon AU', patterns: ['amazon'], hosts: ['amazon.com.au'],
    zenrows: { search: (s) => `https://www.amazon.com.au/s?k=${q(s)}`, productPath: /\/dp\/[A-Z0-9]{10}/, jsRender: false } },
  { name: 'eBay AU', patterns: ['ebay'], hosts: ['ebay.com.au'],
    zenrows: { search: (s) => `https://www.ebay.com.au/sch/i.html?_nkw=${q(s)}`, productPath: /\/itm\/\d+/, jsRender: false } },
  // Merchants that already exist in Payload (added by earlier imports).
  { name: 'Dick Smith', patterns: ['dick smith'], hosts: ['dicksmith.com.au'] },
  { name: 'Videopro', patterns: ['videopro'], hosts: ['videopro.com.au'] },
  { name: 'Domayne', patterns: ['domayne'], hosts: ['domayne.com.au'] },
  { name: 'Mobileciti', patterns: ['mobileciti'], hosts: ['mobileciti.com.au'] },
  { name: 'Jaycar', patterns: ['jaycar'], hosts: ['jaycar.com.au'] },
  { name: 'Beacon Lighting', patterns: ['beacon lighting'], hosts: ['beaconlighting.com.au'] },
  { name: 'Telstra', patterns: ['telstra'], hosts: ['telstra.com.au'] },
  { name: 'Reebelo AU', patterns: ['reebelo'], hosts: ['reebelo.com.au'] },
  // Brand stores: the domains are global, so the AU check is the seller listing itself.
  { name: 'Sonos AU', patterns: ['sonos'], hosts: ['sonos.com'] },
  { name: 'Apple AU', patterns: ['apple store', 'apple au', 'apple'], hosts: ['apple.com'] },
  { name: 'Anker AU', patterns: ['anker'], hosts: ['anker.com', 'ankersolix.com'] },
  { name: 'eufy AU', patterns: ['eufy'], hosts: ['eufy.com'] },
  { name: 'Reolink AU', patterns: ['reolink'], hosts: ['reolink.com'] },
  { name: 'LIFX AU', patterns: ['lifx'], hosts: ['lifx.com.au', 'lifx.com'] },
]

/** Grey-market importers and second-hand resellers: no Australian warranty. */
export const EXCLUDED_SELLERS = ['desertcart', 'u-buy', 'ubuy', 'big apple buddy', 'snapklik', 'techinn', 'microless', 'playthek',
  'mcgrocer', 'crowdshop', 'good buyz', 'etsy', 'cex', 'cash converters', 'shopee', 'walmart', 'aliexpress']

/** Retailers ZenRows can verify / gap-fill. */
export const ZENROWS_RETAILERS = AU_RETAILERS.filter((r) => r.zenrows)

export type SellerMatch =
  | { status: 'matched'; retailer: AuRetailer }
  | { status: 'excluded'; reason: string }
  | { status: 'unknown' }
  | { status: 'host-mismatch'; retailer: AuRetailer; host: string }

export function isExcludedSeller(title: string | null | undefined): string | null {
  const s = (title || '').toLowerCase()
  return EXCLUDED_SELLERS.find((x) => s.includes(x)) ?? null
}

export function hostOf(url: string | null | undefined): string | null {
  if (!url || !/^https?:\/\//i.test(url)) return null
  try { return new URL(url).hostname.toLowerCase() } catch { return null }
}

export function hostAllowed(retailer: AuRetailer, url: string | null | undefined): boolean {
  const host = hostOf(url)
  if (!host) return false
  return retailer.hosts.some((h) => host === h || host.endsWith(`.${h}`))
}

/**
 * Match a DataForSEO seller title (and, when given, its URL) to an AU retailer.
 * Excluded sellers win over any pattern ("Big Apple Buddy" is never Apple).
 */
export function matchRetailer(sellerTitle: string | null | undefined, url?: string | null): SellerMatch {
  const s = (sellerTitle || '').toLowerCase()
  if (!s) return { status: 'unknown' }
  const excluded = isExcludedSeller(s)
  if (excluded) return { status: 'excluded', reason: `grey-market/second-hand seller (${excluded})` }
  const retailer = AU_RETAILERS.find((r) => r.patterns.some((p) => s.includes(p)))
  if (!retailer) return { status: 'unknown' }
  if (url !== undefined && !hostAllowed(retailer, url)) return { status: 'host-mismatch', retailer, host: hostOf(url) ?? String(url) }
  return { status: 'matched', retailer }
}

export function retailerByName(name: string): AuRetailer | undefined {
  const n = name.toLowerCase()
  return AU_RETAILERS.find((r) => r.name.toLowerCase() === n)
}

/** Retailer for a URL by host alone (used for offers whose merchant name is unusual). */
export function retailerByUrl(url: string): AuRetailer | undefined {
  return AU_RETAILERS.find((r) => hostAllowed(r, url))
}

export interface MerchantRef { id: number; name: string; active?: boolean | null }

/**
 * Map retailer names to Payload merchants by exact (case-insensitive) name.
 * Returns the lookup plus the retailers that have no Merchant record.
 */
export function resolveMerchants(merchants: MerchantRef[]) {
  const byName = new Map(merchants.map((m) => [m.name.toLowerCase(), m]))
  const lookup = new Map<string, MerchantRef>()
  const missing: string[] = []
  for (const r of AU_RETAILERS) {
    const m = byName.get(r.name.toLowerCase())
    if (m) lookup.set(r.name, m)
    else missing.push(r.name)
  }
  return { lookup, missing }
}
