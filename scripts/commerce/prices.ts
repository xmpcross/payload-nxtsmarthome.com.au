/**
 * Payload-native product price / offer tool. Review-first: every command prints a change
 * report and saves JSON + Markdown under app/scratch/price-runs/, and nothing is saved to
 * Payload unless --write is passed.
 *
 *   prices.sh search "<query>" [--limit 10] [--max-cost 1]
 *   prices.sh refresh [--product <slug>] [--limit N] [--write] [--drop-stale] [--max-cost 1]
 *   prices.sh link [--inactive|--all] [--product <slug>] [--limit N] [--write] [--max-cost 1]
 *   prices.sh zenrows [--product <slug>] [--retailer "JB Hi-Fi"] [--verify|--fill] [--limit N] [--write] [--max-requests 50]
 *   prices.sh report
 *
 * refresh / link / zenrows consider active products by default; --inactive selects only
 * products with active = false and --all selects both.
 *
 * Global: --fixture <dir> reads recorded API responses from disk instead of calling
 * DataForSEO / ZenRows (Payload is still read). --write is refused in fixture mode.
 * See scripts/commerce/README.md.
 */
import fs from 'node:fs'
import path from 'node:path'
import type { Payload } from 'payload'
import { ZENROWS_RETAILERS, hostAllowed, matchRetailer, resolveMerchants, retailerByName, retailerByUrl, type AuRetailer, type MerchantRef } from './lib/au-retailers'
import { DataForSeoClient, PUBLISHED_COST, SERP_SIZE, serpsFor, spec, type DfsProductInfo } from './lib/dataforseo'
import { extractPrice, extractSearchResults } from './lib/extract-price'
import { chooseLink, linkQuery, summariseLinks, type LinkResult } from './lib/link'
import { findInCatalogue, identityMatch, normaliseGtin } from './lib/match'
import { planProduct, summarise, type Change, type Observation, type ProductPlan } from './lib/plan'
import { acquireLock, latestReport, renderMarkdown, saveReport, type CostEstimate, type FillCandidate, type RunReport, type SearchCandidate } from './lib/report'
import { applyLinks, applyPlans, loadCatalogue, loadMerchants, type CatalogueProduct } from './lib/store'
import { RequestBudgetExceeded, ZenRowsClient } from './lib/zenrows'

// ---------------------------------------------------------------- arguments
const BOOLEAN_FLAGS = new Set(['write', 'drop-stale', 'verify', 'fill', 'help', 'inactive', 'all'])
function parseArgs(argv: string[]) {
  const positional: string[] = []
  const flags = new Map<string, string | true>()
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (!a.startsWith('--')) { positional.push(a); continue }
    const [k, inline] = a.slice(2).split(/=(.*)/s, 2) as [string, string | undefined]
    if (inline !== undefined) flags.set(k, inline)
    else if (BOOLEAN_FLAGS.has(k)) flags.set(k, true)
    else if (argv[i + 1] === undefined || argv[i + 1].startsWith('--')) throw new Error(`--${k} needs a value`)
    else flags.set(k, argv[++i])
  }
  return { positional, flags }
}
const rawArgs = process.argv.slice(2)
const { positional, flags } = parseArgs(rawArgs)
const command = positional[0]
const str = (k: string) => { const v = flags.get(k); return typeof v === 'string' ? v : undefined }
const num = (k: string, d: number) => {
  const v = str(k)
  if (v === undefined) return d
  const n = Number(v)
  if (!Number.isFinite(n) || n < 0) throw new Error(`--${k} must be a non-negative number`)
  return n
}
const write = flags.has('write')
const fixtureDir = str('fixture') ? path.resolve(str('fixture')!) : null
const log = (msg: string) => console.error(msg)

const USAGE = `Usage: prices.sh <command> [options]

  search "<query>" [--limit 10]               Google Shopping candidates (report only, never writes)
  refresh [--product slug] [--limit N]         DataForSEO product_info by googleProductId
          [--write] [--drop-stale] [--max-cost 1]
  link [--product slug] [--limit N]            Find the Google Shopping product id for products without one
          [--write] [--max-cost 1]             (--write sets googleProductId on MATCHED products only)
  zenrows [--product slug] [--retailer name]   Verify offer prices on retailer pages (--verify, default)
          [--verify] [--fill] [--limit N]      and/or fill missing supported retailers (--fill)
          [--write] [--max-requests 50]
  report                                       Show the last saved run report

  --inactive        refresh/link/zenrows: only products with active = false (default: active only)
  --all             refresh/link/zenrows: active and inactive products
  --fixture <dir>   read recorded API responses from <dir> (offline; --write refused)
  --timeout-min N   DataForSEO task polling timeout (default 25)
Reports: app/scratch/price-runs/. Nothing is saved to Payload without --write.`

// ---------------------------------------------------------------- helpers
interface Manifest { note?: string; zenrows?: Record<string, string> }
function readManifest(): Manifest {
  if (!fixtureDir) return {}
  const file = path.join(fixtureDir, 'manifest.json')
  if (!fs.existsSync(file)) throw new Error(`--fixture ${fixtureDir}: manifest.json not found`)
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

const checkedAt = (p: CatalogueProduct) => (typeof p.sourceData.pricesCheckedAt === 'string' ? Date.parse(p.sourceData.pricesCheckedAt) || 0 : 0)
/** Least recently checked first, so a limited (or cron) run works through the catalogue. */
const byOldestCheck = (a: CatalogueProduct, b: CatalogueProduct) => checkedAt(a) - checkedAt(b) || a.id - b.id

type Scope = 'active' | 'inactive' | 'all'
/** --inactive / --all widen the selection; the default stays active products only. */
function scope(): Scope {
  if (flags.has('inactive') && flags.has('all')) throw new Error('use either --inactive or --all, not both')
  return flags.has('all') ? 'all' : flags.has('inactive') ? 'inactive' : 'active'
}
const inScope = (p: CatalogueProduct, s: Scope = scope()) => s === 'all' || (s === 'active' ? p.active : !p.active)

/** Products in scope that pass `filter`, least recently checked first; --product picks one slug regardless of scope. */
function selectProducts(catalogue: CatalogueProduct[], filter: (p: CatalogueProduct) => boolean, limit: number): CatalogueProduct[] {
  const slug = str('product')
  if (slug) {
    const p = catalogue.find((x) => x.slug === slug)
    if (!p) throw new Error(`No product with slug "${slug}"`)
    return [p]
  }
  const list = catalogue.filter((p) => inScope(p) && filter(p)).sort(byOldestCheck)
  return limit ? list.slice(0, limit) : list
}

function newReport(cmd: string): RunReport {
  return { command: cmd, args: rawArgs, startedAt: new Date().toISOString(), mode: write ? 'write' : 'review', fixture: fixtureDir ? path.relative(process.cwd(), fixtureDir) || '.' : null, cost: {}, warnings: [] }
}

function dfsClient() {
  return new DataForSeoClient({
    login: process.env.DATAFORSEO_LOGIN, password: process.env.DATAFORSEO_PASSWORD, maxCost: num('max-cost', 1),
    fixtureDir: fixtureDir ?? undefined, timeoutMs: num('timeout-min', 25) * 60_000, log,
  })
}
function dfsCost(dfs: DataForSeoClient, maxCost: number): NonNullable<RunReport['cost']['dataforseo']> {
  return { spentUsd: Math.round(dfs.spent * 10000) / 10000, tasks: dfs.tasksPosted, maxCostUsd: maxCost, simulated: dfs.simulated, notPostedForBudget: dfs.skippedForBudget }
}

/** Observations from one product_info result, plus skip entries for sellers that were rejected. */
function sellerObservations(item: DfsProductInfo, merchants: Map<string, MerchantRef>) {
  const observations: Observation[] = []
  const skips: Change[] = []
  const ignored: string[] = []
  for (const s of item.sellers ?? []) {
    const title = s.title ?? ''
    const m = matchRetailer(title, s.url ?? null)
    if (m.status === 'excluded') { skips.push({ kind: 'skip', retailer: title, reason: m.reason, price: s.price?.current ?? null }); continue }
    if (m.status === 'unknown') { if (title) ignored.push(title); continue }
    if (m.status === 'host-mismatch') { skips.push({ kind: 'skip', retailer: m.retailer.name, reason: `seller "${title}" URL host ${m.host} is not on the ${m.retailer.name} allow-list`, price: s.price?.current ?? null }); continue }
    const currency = s.price?.currency
    if (currency && currency.toUpperCase() !== 'AUD') { skips.push({ kind: 'skip', retailer: m.retailer.name, reason: `price in ${currency}, not AUD` }); continue }
    const price = typeof s.price?.current === 'number' ? s.price.current : null
    observations.push({
      retailer: m.retailer.name, merchantId: merchants.get(m.retailer.name)?.id ?? null, price, url: s.url ?? undefined,
      source: 'dataforseo', kind: 'price', sellerTitle: title, availability: s.product_availability ?? undefined,
    })
  }
  return { observations, skips, ignored }
}

function missingMerchantWarnings(plans: ProductPlan[]): string[] {
  const names = new Set<string>()
  for (const p of plans) for (const c of p.changes) if (c.kind === 'skip' && c.reason.startsWith('no Merchant record')) names.add(c.retailer)
  return [...names].map((n) => `Retailer "${n}" has no Merchant record in Payload; its offers were skipped (merchants are never created by this tool)`)
}

// ---------------------------------------------------------------- refresh
async function refresh(payload: Payload, report: RunReport) {
  const maxCost = num('max-cost', 1)
  const merchants = await loadMerchants(payload)
  const catalogue = await loadCatalogue(payload, merchants)
  const { lookup } = resolveMerchants(merchants)
  const hasFixture = (p: CatalogueProduct) => !fixtureDir || fs.existsSync(path.join(fixtureDir, 'dataforseo', 'product_info', `${p.googleProductId}.json`))
  const targets = selectProducts(catalogue, (p) => Boolean(p.googleProductId) && hasFixture(p), num('limit', 0))
  if (str('product') && !targets[0].googleProductId) throw new Error(`${targets[0].slug} has no googleProductId; refresh looks products up by id`)
  if (fixtureDir) report.warnings.push('Fixture mode: only products with a recorded product_info response are considered')
  if (scope() !== 'active') report.warnings.push(`Scope: ${scope()} products. Offers are added/updated as usual; product active flags are never changed.`)
  const dfs = dfsClient()
  log(`refresh: ${targets.length} product(s), estimated $${dfs.estimate('product_info', targets.length).toFixed(4)} (budget $${maxCost})`)
  const results = await dfs.productInfo(targets.map((p) => p.googleProductId!))
  const now = new Date()
  const plans: ProductPlan[] = []
  for (const p of targets) {
    const r = results.get(p.googleProductId!)
    const item = r?.result ?? null
    let note: string | undefined
    let observations: Observation[] = [], skips: Change[] = []
    let gtinMismatch = false
    if (!r) note = 'not looked up: --max-cost budget reached'
    else if (!item) note = `no result (${r.error ?? 'empty'}); product left as it is`
    else if (p.gtin && normaliseGtin(spec(item, 'GTIN', 'EAN', 'UPC', 'GTIN-13')) && normaliseGtin(spec(item, 'GTIN', 'EAN', 'UPC', 'GTIN-13')) !== normaliseGtin(p.gtin)) {
      // The linked Google product states a different barcode: its sellers are not this product's.
      note = `GTIN mismatch: Google product ${p.googleProductId} has GTIN ${spec(item, 'GTIN', 'EAN', 'UPC', 'GTIN-13')}, the product has ${p.gtin}; nothing changed. Check its googleProductId.`
      gtinMismatch = true
    } else {
      const s = sellerObservations(item, lookup)
      observations = s.observations; skips = s.skips
      if (!observations.length) note = 'no AU retailer offers in the result; nothing changed'
      if (s.ignored.length) note = `${note ? `${note}. ` : ''}${s.ignored.length} non-AU/unlisted seller(s) ignored: ${s.ignored.slice(0, 6).join(', ')}${s.ignored.length > 6 ? ', …' : ''}`
    }
    const plan = planProduct(p, observations, { now, checkStale: true, dropStale: flags.has('drop-stale') && Boolean(item), note })
    plan.changes.push(...skips)
    plan.observed = Boolean(item) && !gtinMismatch
    plans.push(plan)
  }
  report.cost.dataforseo = dfsCost(dfs, maxCost)
  if (dfs.skippedForBudget.length) report.warnings.push(`${dfs.skippedForBudget.length} product(s) not looked up because of --max-cost $${maxCost}`)
  report.warnings.push(...missingMerchantWarnings(plans))
  report.plans = plans
  report.summary = summarise(plans)
  if (write) report.written = await applyPlans(payload, plans, catalogue, now)
}

// ---------------------------------------------------------------- link
async function link(payload: Payload, report: RunReport) {
  const maxCost = num('max-cost', 1)
  const depth = num('depth', SERP_SIZE)
  const merchants = await loadMerchants(payload)
  const catalogue = await loadCatalogue(payload, merchants)
  const hasFixture = (p: CatalogueProduct) => !fixtureDir || fs.existsSync(path.join(fixtureDir, 'dataforseo', 'products', `${p.slug}.json`))
  const targets = selectProducts(catalogue, (p) => !p.googleProductId && hasFixture(p), num('limit', 0))
  if (str('product') && targets[0].googleProductId) throw new Error(`${targets[0].slug} already has googleProductId ${targets[0].googleProductId}; link only fills missing ids`)
  if (fixtureDir) report.warnings.push('Fixture mode: only products with a recorded Shopping search (dataforseo/products/<slug>.json) are considered')
  const scopeCount = catalogue.filter((p) => inScope(p) && !p.googleProductId).length
  const linkedIds = new Map(catalogue.filter((p) => p.googleProductId).map((p) => [p.googleProductId!, p.slug]))

  const dfs = dfsClient()
  const serps = serpsFor(depth)
  const searchUsd = targets.length * serps * PUBLISHED_COST.products
  const infoUsd = targets.length * PUBLISHED_COST.product_info
  const perProduct = serps * PUBLISHED_COST.products + PUBLISHED_COST.product_info
  const estimate: CostEstimate = {
    products: targets.length, searches: targets.length, serpsPerSearch: serps, searchUsd, productInfoUsdMax: infoUsd, totalUsdMax: searchUsd + infoUsd,
    guardUsd: dfs.estimate('products', targets.length, serps), scopeProducts: scopeCount, scopeTotalUsdMax: scopeCount * perProduct,
    basis: `DataForSEO Standard queue: Products $${PUBLISHED_COST.products}/SERP of ${SERP_SIZE} results, Product Info $${PUBLISHED_COST.product_info}/product (dataforseo.com/pricing, checked 2026-10-17)`,
  }
  log(`link: ${targets.length} product(s) without a googleProductId (${scope()} scope; ${scopeCount} in the whole scope)`)
  log(`  cost estimate: ${targets.length} search(es) x ${serps} SERP = $${searchUsd.toFixed(4)} now; the follow-up refresh adds up to $${infoUsd.toFixed(4)} of product_info; total up to $${estimate.totalUsdMax.toFixed(4)}`)
  log(`  whole scope (${scopeCount} product(s)): up to $${estimate.scopeTotalUsdMax.toFixed(4)}; budget guard for this run $${estimate.guardUsd.toFixed(4)} of --max-cost $${maxCost}`)

  const jobs = targets.map((p) => ({ tag: p.slug, keyword: linkQuery(p) }))
  const found = targets.length ? await dfs.productsMany(jobs, depth) : new Map()
  const results: LinkResult[] = targets.map((p, i) => {
    const r = found.get(p.slug)
    const base = { productId: p.id, slug: p.slug, name: p.name, brand: p.brand, query: jobs[i].keyword, candidates: [] }
    if (!r) return { ...base, status: 'not-searched' as const, reason: 'not searched: --max-cost budget reached' }
    if (!r.result) return { ...base, status: 'error' as const, reason: `search failed: ${r.error ?? 'no result'}` }
    return chooseLink(p, r.result, { linkedIds, query: jobs[i].keyword })
  })
  // Two products in this run claiming the same Google product: neither is certain.
  const claims = new Map<string, LinkResult[]>()
  for (const r of results) if (r.status === 'matched') claims.set(r.googleProductId!, [...(claims.get(r.googleProductId!) ?? []), r])
  for (const [id, list] of claims) {
    if (list.length < 2) continue
    for (const r of list) { r.status = 'ambiguous'; r.reason = `Google product ${id} also matched ${list.filter((x) => x !== r).map((x) => x.slug).join(', ')} in this run` }
  }

  report.cost.dataforseo = dfsCost(dfs, maxCost)
  if (dfs.skippedForBudget.length) report.warnings.push(`${dfs.skippedForBudget.length} product(s) not searched because of --max-cost $${maxCost}`)
  if (write) report.linkWritten = await applyLinks(payload, results, new Date())
  report.link = { summary: summariseLinks(results), estimate, results }
}

// ---------------------------------------------------------------- zenrows
async function zenrows(payload: Payload, report: RunReport, manifest: Manifest) {
  const doVerify = flags.has('verify') || !flags.has('fill')
  const doFill = flags.has('fill')
  const maxRequests = num('max-requests', 50)
  let retailers = ZENROWS_RETAILERS
  const wanted = str('retailer')
  if (wanted) {
    const r = retailerByName(wanted)
    if (!r?.zenrows) throw new Error(`--retailer "${wanted}" is not supported. Supported: ${ZENROWS_RETAILERS.map((x) => x.name).join(', ')}`)
    retailers = [r]
  }
  const supported = new Set(retailers.map((r) => r.name))
  const merchants = await loadMerchants(payload)
  const catalogue = await loadCatalogue(payload, merchants)
  const { lookup } = resolveMerchants(merchants)
  const fixtureSlugs = new Set(Object.keys(manifest.zenrows ?? {}).map((k) => k.split(':').slice(2).join(':')))
  const targets = selectProducts(catalogue, (p) => !fixtureDir || fixtureSlugs.has(p.slug), num('limit', 10))
  if (fixtureDir) report.warnings.push('Fixture mode: only products with recorded ZenRows pages are considered')
  const zr = new ZenRowsClient({ apiKey: process.env.ZENROWS_API_KEY, maxRequests, concurrency: num('concurrency', 3), fixtureDir: fixtureDir ?? undefined, fixtureMap: manifest.zenrows, log })
  log(`zenrows: ${targets.length} product(s), ${[doVerify && 'verify', doFill && 'fill'].filter(Boolean).join(' + ')}, retailers: ${[...supported].join(', ')}, max ${maxRequests} request(s)`)
  const now = new Date()
  const plans: ProductPlan[] = []
  const fillCandidates: FillCandidate[] = []
  let budgetHit = false
  const unchecked: string[] = []

  const guarded = async <T>(label: string, fn: () => Promise<T>): Promise<T | null> => {
    if (budgetHit) { unchecked.push(label); return null }
    try { return await fn() } catch (e) {
      if (e instanceof RequestBudgetExceeded) { budgetHit = true; unchecked.push(label); return null }
      throw e
    }
  }

  for (const p of targets) {
    const observations: Observation[] = []
    const skips: Change[] = []
    const jobs: Promise<unknown>[] = []

    if (doVerify) {
      for (const offer of p.offers) {
        if (!offer.active || !/^https?:\/\//i.test(offer.url)) continue
        const retailer = retailerByName(offer.merchantName) ?? retailerByUrl(offer.url)
        if (!retailer?.zenrows || !supported.has(retailer.name)) continue
        if (!hostAllowed(retailer, offer.url)) { skips.push({ kind: 'skip', retailer: retailer.name, reason: `offer #${offer.id} URL is not on the ${retailer.name} host allow-list`, url: offer.url }); continue }
        jobs.push(guarded(`verify ${p.slug} @ ${retailer.name}`, async () => {
          const res = await zr.fetchHtml(offer.url, { jsRender: retailer.zenrows!.jsRender, fixtureKey: `product:${retailer.name}:${p.slug}` })
          if (!res.ok) { skips.push({ kind: 'skip', retailer: retailer.name, reason: `page fetch failed: ${res.error}`, url: offer.url }); return }
          const x = extractPrice(res.html, retailer.name)
          if (x.price == null) { skips.push({ kind: 'skip', retailer: retailer.name, reason: `no price on page: ${x.reason}`, url: offer.url }); return }
          observations.push({ retailer: retailer.name, merchantId: offer.merchantId, offerId: offer.id, price: x.price, url: offer.url, source: 'zenrows', kind: 'verify', availability: x.availability })
        }))
      }
    }

    if (doFill) {
      for (const retailer of retailers) {
        const merchant = lookup.get(retailer.name)
        if (!merchant) { skips.push({ kind: 'skip', retailer: retailer.name, reason: 'no Merchant record in Payload (not created)' }); continue }
        if (p.offers.some((o) => o.merchantId === merchant.id)) continue
        jobs.push(guarded(`fill ${p.slug} @ ${retailer.name}`, () => fillOne(p, retailer, merchant, zr, observations, skips, fillCandidates)))
      }
    }

    await Promise.all(jobs)
    const plan = planProduct(p, observations, { now, checkStale: false })
    plan.changes.push(...skips)
    plans.push(plan)
  }

  report.cost.zenrows = { requests: zr.requests, credits: zr.credits, failures: zr.failures, maxRequests, simulated: zr.simulated }
  if (budgetHit) report.warnings.push(`--max-requests ${maxRequests} reached; not checked: ${unchecked.join('; ')}`)
  report.warnings.push(...missingMerchantWarnings(plans))
  report.plans = plans
  report.fillCandidates = fillCandidates
  report.summary = summarise(plans)
  if (write) report.written = await applyPlans(payload, plans, catalogue, now)
}

/** Search one retailer for a product; propose an offer only on a confirmed brand+model or GTIN match. */
async function fillOne(p: CatalogueProduct, retailer: AuRetailer, merchant: MerchantRef, zr: ZenRowsClient,
  observations: Observation[], skips: Change[], candidates: FillCandidate[]) {
  const z = retailer.zenrows!
  const query = `${p.brand ?? ''} ${p.name}`.trim()
  const searchUrl = z.search(query)
  const res = await zr.fetchHtml(searchUrl, { jsRender: z.jsRender, fixtureKey: `search:${retailer.name}:${p.slug}` })
  if (!res.ok) { skips.push({ kind: 'skip', retailer: retailer.name, reason: `search fetch failed: ${res.error}` }); return }
  const results = extractSearchResults(res.html, searchUrl, z.productPath, 8)
  if (!results.length) { skips.push({ kind: 'skip', retailer: retailer.name, reason: 'search page had no product results' }); return }
  const scored = results.map((r) => ({ ...r, id: identityMatch({ brand: p.brand, name: p.name, gtin: p.gtin }, { title: r.title }) }))
  const hit = scored.find((r) => r.id.match)
  if (!hit) {
    for (const r of scored.slice(0, 3)) candidates.push({ product: p.slug, retailer: retailer.name, title: r.title, url: r.url, reason: r.id.reason })
    return
  }
  const page = await zr.fetchHtml(hit.url, { jsRender: z.jsRender, fixtureKey: `product:${retailer.name}:${p.slug}` })
  if (!page.ok) { candidates.push({ product: p.slug, retailer: retailer.name, title: hit.title, url: hit.url, reason: `title matched (${hit.id.reason}) but product page fetch failed: ${page.error}` }); return }
  const x = extractPrice(page.html, retailer.name)
  // The product page has the final say on identity when it states a GTIN.
  const pageId = x.gtin && p.gtin ? identityMatch({ brand: p.brand, name: p.name, gtin: p.gtin }, { title: x.title ?? hit.title, gtin: x.gtin }) : hit.id
  if (!pageId.match) { candidates.push({ product: p.slug, retailer: retailer.name, title: x.title ?? hit.title, url: hit.url, reason: pageId.reason, price: x.price }); return }
  if (x.price == null) { candidates.push({ product: p.slug, retailer: retailer.name, title: hit.title, url: hit.url, reason: `matched (${pageId.reason}) but no price on page: ${x.reason}` }); return }
  observations.push({ retailer: retailer.name, merchantId: merchant.id, price: x.price, url: hit.url, source: 'zenrows', kind: 'price', sellerTitle: x.title ?? hit.title, availability: x.availability })
}

// ---------------------------------------------------------------- search
async function search(payload: Payload, report: RunReport) {
  const query = positional.slice(1).join(' ').trim()
  if (!query) throw new Error('search needs a query, e.g. prices.sh search "aqara hub"')
  const limit = num('limit', 10)
  const maxCost = num('max-cost', 1)
  const merchants = await loadMerchants(payload)
  const catalogue = await loadCatalogue(payload, merchants)
  const dfs = dfsClient()
  log(`search "${query}": 1 Shopping task + up to ${limit} product_info task(s), estimated $${(dfs.estimate('products', 1) + dfs.estimate('product_info', limit)).toFixed(4)} (budget $${maxCost})`)
  const found = await dfs.products(query, 100)
  if (!found.result) throw new Error(`Google Shopping search failed: ${found.error}`)
  const seen = new Map<string, (typeof found.result)[number]>()
  for (const it of [...found.result].sort((a, b) => (a.rank_absolute ?? 999) - (b.rank_absolute ?? 999))) {
    const key = it.product_id ? `pid:${it.product_id}` : it.data_docid ? `doc:${it.data_docid}` : null
    if (!key || !it.title || seen.has(key)) continue
    seen.set(key, it)
  }
  const top = [...seen.values()].slice(0, limit)
  const ids = top.map((t) => t.product_id).filter((x): x is string => Boolean(x))
  const info = ids.length ? await dfs.productInfo(ids) : new Map()
  const candidates: SearchCandidate[] = top.map((it, i) => {
    const r = it.product_id ? info.get(String(it.product_id)) : undefined
    const item: DfsProductInfo | null = r?.result ?? null
    const au = new Map<string, number>()
    for (const s of item?.sellers ?? []) {
      const m = matchRetailer(s.title, s.url ?? null)
      const price = s.price?.current
      if (m.status !== 'matched' || typeof price !== 'number' || price <= 0 || (s.price?.currency && s.price.currency !== 'AUD')) continue
      au.set(m.retailer.name, Math.min(price, au.get(m.retailer.name) ?? Infinity))
    }
    const prices = [...au.values()]
    const title = (item?.title ?? it.title ?? '').trim()
    const brand = spec(item, 'Brand') ?? title.split(/\s+/)[0] ?? null
    const note = !it.product_id ? 'no Google product id in the listing: AU offers cannot be looked up (product_info needs an id)'
      : !r ? 'product_info not looked up (--max-cost budget)' : !item ? `product_info: ${r.error ?? 'no result'}` : undefined
    return {
      rank: i + 1, title, brand, googleProductId: it.product_id ?? null, dataDocId: it.data_docid ?? null,
      gtin: spec(item, 'GTIN', 'EAN', 'UPC', 'GTIN-13') ?? null,
      listingPrice: typeof it.price === 'number' ? it.price : null, listingSeller: it.seller ?? null,
      auOfferCount: item ? au.size : null, auPriceMin: prices.length ? Math.min(...prices) : null, auPriceMax: prices.length ? Math.max(...prices) : null,
      auRetailers: [...au.keys()], inCatalogue: findInCatalogue({ productId: it.product_id, title, brand }, catalogue), note,
    }
  })
  report.cost.dataforseo = dfsCost(dfs, maxCost)
  report.search = { query, candidates }
  if (write) report.warnings.push('--write ignored: search is report-only')
}

// ---------------------------------------------------------------- main
async function main(): Promise<number> {
  if (!command || flags.has('help') || !['search', 'refresh', 'link', 'zenrows', 'report'].includes(command)) {
    console.log(USAGE)
    return command && !flags.has('help') ? 1 : 0
  }
  if (command === 'report') {
    const file = latestReport()
    if (!file) { console.log('No price runs saved yet (app/scratch/price-runs/).'); return 0 }
    console.log(fs.readFileSync(file, 'utf8'))
    console.log(`(${file})`)
    return 0
  }
  if (write && fixtureDir) throw new Error('--write is refused in --fixture mode: fixture data is synthetic and must never reach Payload')
  if (!fixtureDir) {
    if ((command === 'refresh' || command === 'search' || command === 'link') && (!process.env.DATAFORSEO_LOGIN || !process.env.DATAFORSEO_PASSWORD))
      throw new Error('DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD are not set in app/.env.local (or run with --fixture <dir>)')
    if (command === 'zenrows' && !process.env.ZENROWS_API_KEY)
      throw new Error('ZENROWS_API_KEY is not set in app/.env.local (or run with --fixture <dir>)')
  }
  const manifest = readManifest()
  const release = acquireLock(command)
  const report = newReport(command)
  let payload: Payload | null = null
  let code = 0
  try {
    const { getPayload } = await import('payload')
    const config = (await import('../../payload.config')).default
    payload = await getPayload({ config })
    if (command === 'refresh') await refresh(payload, report)
    else if (command === 'zenrows') await zenrows(payload, report, manifest)
    else if (command === 'link') await link(payload, report)
    else await search(payload, report)
    if (report.written?.errors.length || report.linkWritten?.errors.length) code = 1
  } finally {
    report.finishedAt = new Date().toISOString()
    const saved = saveReport(report)
    console.log(renderMarkdown(report))
    if (!write && report.plans?.some((p) => p.changes.some((c) => c.kind !== 'skip' && c.kind !== 'hold'))) console.log('Review only: nothing was saved to Payload. Re-run with --write to apply.')
    if (!write && report.link?.summary.matched) console.log('Review only: no googleProductId was saved. Re-run with --write to link the MATCHED products.')
    console.log(`Report saved: ${saved.md}\n              ${saved.json}`)
    release()
    if (payload) await payload.destroy()
  }
  return code
}

main().then((code) => process.exit(code), (e) => { console.error(`Error: ${(e as Error).message}`); process.exit(1) })

