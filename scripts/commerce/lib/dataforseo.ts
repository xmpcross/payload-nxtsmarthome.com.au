/**
 * DataForSEO client for the price tools: Google Shopping (products, product_info), Amazon AU
 * search (amazon_products) and Google organic results (organic, for `site:` searches).
 *
 * All four use the queue (task_post → task_get); Google Shopping has no live endpoint, and
 * the others use the cheaper Standard queue the same way, so all use the task flow with
 * polling. task_post is where DataForSEO charges: the response carries `cost` per task and
 * in total, which is summed here. `maxCost` is checked BEFORE each post using an estimate
 * per task (refined from the real cost once one batch has been posted), so a run stops
 * before it would exceed the budget rather than after.
 *
 * Fixture mode reads recorded task_get responses from disk instead of calling the API and
 * simulates task_post cost with the estimate, so the guard can be exercised offline:
 *   <fixtureDir>/dataforseo/product_info/<googleProductId>.json
 *   <fixtureDir>/dataforseo/products/<slug of keyword>.json
 *   <fixtureDir>/dataforseo/amazon_products/<tag>.json, <fixtureDir>/dataforseo/organic/<tag>.json
 */
import fs from 'node:fs/promises'
import path from 'node:path'

const BASE = 'https://api.dataforseo.com/v3/'
export const AU_LOCATION_CODE = 2036
export const LANGUAGE_CODE = 'en'
/**
 * DataForSEO's published Standard-queue prices (dataforseo.com/pricing/merchant/google-shopping-api,
 * checked 2026-10-17): Products $0.001 per SERP of up to 40 results (depth 41-80 = 2 SERPs,
 * max depth 120 = 3 SERPs); Product Info $0.001 per product. Priority queue doubles both.
 */
export const PUBLISHED_COST: Record<Endpoint, number> = { product_info: 0.001, products: 0.001, amazon_products: 0.0015, organic: 0.003 }
/** Budget-guard estimate per unit (USD): the published price plus a 50% margin; replaced by the observed average once known. */
export const ESTIMATED_COST: Record<Endpoint, number> = { product_info: 0.0015, products: 0.0015, amazon_products: 0.00225, organic: 0.0045 }
/** A Google Shopping SERP holds up to 40 results; products is billed per SERP. */
export const SERP_SIZE = 40
export const serpsFor = (depth: number) => Math.max(1, Math.ceil(depth / SERP_SIZE))
const BATCH = 100

type Endpoint = 'product_info' | 'products' | 'amazon_products' | 'organic'
/** API path and the request fields each endpoint needs on top of the job body. */
const ENDPOINTS: Record<Endpoint, { path: string; extra: Record<string, unknown> }> = {
  product_info: { path: 'merchant/google/product_info', extra: { language_code: 'en' } },
  products: { path: 'merchant/google/products', extra: { language_code: 'en' } },
  // Amazon prices: Standard queue $0.0015 per task (scripts/commerce/amazon-import.ts, checked 2026-10-17).
  amazon_products: { path: 'merchant/amazon/products', extra: { language_code: 'en_AU', se_domain: 'amazon.com.au' } },
  // Google organic: $0.003 per task as billed on this account (observed 22 Oct 2026; the guard adds 50%).
  organic: { path: 'serp/google/organic', extra: { language_code: 'en' } },
}

export interface DfsPrice { current?: number | null; regular?: number | null; currency?: string | null; displayed_price?: string | null }
export interface DfsSeller { type?: string; title?: string | null; url?: string | null; price?: DfsPrice | null; product_availability?: string | null }
export interface DfsSpecification { specification_name?: string | null; specification_value?: string | null }
export interface DfsProductInfo {
  type?: string; product_id?: string | null; title?: string | null; description?: string | null; url?: string | null
  images?: string[] | null; specifications?: DfsSpecification[] | null; sellers?: DfsSeller[] | null
  rating?: { value?: number | null; votes_count?: number | null } | null
}
export interface DfsShoppingItem {
  type?: string; rank_absolute?: number | null; title?: string | null; price?: number | null; old_price?: number | null
  currency?: string | null; product_id?: string | null; data_docid?: string | null; seller?: string | null; url?: string | null
  shopping_url?: string | null; product_rating?: { value?: number | null } | null; reviews_count?: number | null
}
export interface DfsAmazonItem { type?: string; title?: string | null; url?: string | null; data_asin?: string | null; price_from?: number | null; currency?: string | null }
export interface DfsOrganicItem { type?: string; title?: string | null; url?: string | null; domain?: string | null; description?: string | null }
interface DfsTask<T> { id?: string; status_code?: number; status_message?: string; cost?: number; data?: { tag?: string }; result?: Array<{ items?: T[] | null }> | null }
interface DfsEnvelope<T> { status_code?: number; status_message?: string; cost?: number; tasks?: DfsTask<T>[] }

export class BudgetExceeded extends Error {}

export interface DataForSeoOptions {
  login?: string
  password?: string
  maxCost: number
  fixtureDir?: string
  pollIntervalMs?: number
  timeoutMs?: number
  log?: (msg: string) => void
}

export interface TaskOutcome<T> { result: T | null; error?: string }

export class DataForSeoClient {
  spent = 0
  tasksPosted = 0
  /** Lookups not posted because they would have exceeded maxCost. */
  skippedForBudget: string[] = []
  readonly simulated: boolean
  private observedCost: Partial<Record<Endpoint, number>> = {}
  private headers: Record<string, string>
  private log: (msg: string) => void

  constructor(private opts: DataForSeoOptions) {
    this.simulated = Boolean(opts.fixtureDir)
    this.log = opts.log ?? (() => {})
    if (!opts.fixtureDir && (!opts.login || !opts.password)) throw new Error('DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD are not set (use --fixture <dir> to run offline)')
    this.headers = { Authorization: `Basic ${Buffer.from(`${opts.login ?? ''}:${opts.password ?? ''}`).toString('base64')}`, 'Content-Type': 'application/json' }
  }

  /** Estimated cost of `tasks` tasks of `units` billing units each (units = SERPs for products). */
  estimate(endpoint: Endpoint, tasks: number, units = 1) {
    return (this.observedCost[endpoint] ?? ESTIMATED_COST[endpoint]) * tasks * units
  }

  /** How many of `n` tasks fit in the remaining budget. */
  private affordable(endpoint: Endpoint, n: number, units: number) {
    const per = (this.observedCost[endpoint] ?? ESTIMATED_COST[endpoint]) * units
    const left = this.opts.maxCost - this.spent
    return Math.max(0, Math.min(n, Math.floor((left + 1e-9) / per)))
  }

  /** product_info for each Google product id. Ids skipped for budget are listed in skippedForBudget. */
  async productInfo(ids: string[]): Promise<Map<string, TaskOutcome<DfsProductInfo>>> {
    const unique = [...new Set(ids.map(String))]
    const out = new Map<string, TaskOutcome<DfsProductInfo>>()
    const items = await this.run<DfsProductInfo>('product_info', unique.map((id) => ({ tag: id, body: { product_id: id } })))
    for (const [tag, r] of items) out.set(tag, { result: r.result?.[0] ?? null, error: r.error })
    return out
  }

  /** Google Shopping search for a keyword (depth = number of results; billed per 100). */
  async products(keyword: string, depth = 100): Promise<TaskOutcome<DfsShoppingItem[]>> {
    const tag = slugify(keyword)
    const items = await this.run<DfsShoppingItem>('products', [{ tag, body: { keyword, depth } }], serpsFor(depth))
    const r = items.get(tag)
    if (!r) return { result: null, error: 'not posted (budget)' }
    return { result: r.result ?? [], error: r.error }
  }

  /**
   * Several Google Shopping searches, one task each, posted in batches of up to 100.
   * Each job's tag is the caller's key (and, in fixture mode, the fixture file name).
   * Tags skipped for budget are absent from the map and listed in skippedForBudget.
   */
  async productsMany(jobs: Array<{ tag: string; keyword: string }>, depth = SERP_SIZE): Promise<Map<string, TaskOutcome<DfsShoppingItem[]>>> {
    const items = await this.run<DfsShoppingItem>('products', jobs.map((j) => ({ tag: j.tag, body: { keyword: j.keyword, depth } })), serpsFor(depth))
    const out = new Map<string, TaskOutcome<DfsShoppingItem[]>>()
    for (const [tag, r] of items) out.set(tag, { result: r.result ?? (r.error ? null : []), error: r.error })
    return out
  }

  /** Amazon AU searches, one task each (depth up to 100 results, one billing unit). */
  async amazonMany(jobs: Array<{ tag: string; keyword: string }>, depth = 20): Promise<Map<string, TaskOutcome<DfsAmazonItem[]>>> {
    return this.many<DfsAmazonItem>('amazon_products', jobs.map((j) => ({ tag: j.tag, body: { keyword: j.keyword, depth } })))
  }

  /** Google organic searches (e.g. `site:jbhifi.com.au Aqara Hub M3`), one 10-result SERP each. */
  async organicMany(jobs: Array<{ tag: string; keyword: string }>): Promise<Map<string, TaskOutcome<DfsOrganicItem[]>>> {
    return this.many<DfsOrganicItem>('organic', jobs.map((j) => ({ tag: j.tag, body: { keyword: j.keyword, depth: 10 } })))
  }

  private async many<T>(endpoint: Endpoint, jobs: Array<{ tag: string; body: Record<string, unknown> }>): Promise<Map<string, TaskOutcome<T[]>>> {
    const items = await this.run<T>(endpoint, jobs)
    const out = new Map<string, TaskOutcome<T[]>>()
    for (const [tag, r] of items) out.set(tag, { result: r.result ?? (r.error ? null : []), error: r.error })
    return out
  }

  private async run<T>(endpoint: Endpoint, jobs: Array<{ tag: string; body: Record<string, unknown> }>, units = 1): Promise<Map<string, { result: T[] | null; error?: string }>> {
    const out = new Map<string, { result: T[] | null; error?: string }>()
    const taskIds = new Map<string, string>()
    for (let i = 0; i < jobs.length; i += BATCH) {
      let batch = jobs.slice(i, i + BATCH)
      const fit = this.affordable(endpoint, batch.length, units)
      if (fit < batch.length) {
        for (const j of jobs.slice(i + fit)) this.skippedForBudget.push(j.tag)
        batch = batch.slice(0, fit)
        this.log(`--max-cost $${this.opts.maxCost}: posting ${fit} more task(s); ${jobs.length - i - fit} not posted`)
        if (!batch.length) break
      }
      if (this.opts.fixtureDir) {
        this.spent += this.estimate(endpoint, batch.length, units)
        this.tasksPosted += batch.length
        for (const j of batch) taskIds.set(j.tag, `fixture:${j.tag}`)
        if (fit < Math.min(BATCH, jobs.length - i)) break
        continue
      }
      const body = batch.map((j) => ({ ...j.body, location_code: AU_LOCATION_CODE, ...ENDPOINTS[endpoint].extra, tag: j.tag }))
      const res = await fetch(`${BASE}${ENDPOINTS[endpoint].path}/task_post`, { method: 'POST', headers: this.headers, body: JSON.stringify(body) })
      if (!res.ok) throw new Error(`DataForSEO ${endpoint} task_post HTTP ${res.status}`)
      const env = await res.json() as DfsEnvelope<T>
      if (env.status_code !== 20000) throw new Error(`DataForSEO ${endpoint} task_post: ${env.status_code} ${env.status_message}`)
      let batchCost = 0, posted = 0
      for (const t of env.tasks ?? []) {
        batchCost += Number(t.cost ?? 0)
        const tag = t.data?.tag
        if (!tag) continue
        if (t.id && t.status_code === 20100) { taskIds.set(tag, t.id); posted++ } else out.set(tag, { result: null, error: `task_post ${t.status_code} ${t.status_message}` })
      }
      if (!batchCost && typeof env.cost === 'number') batchCost = env.cost
      this.spent += batchCost
      this.tasksPosted += posted
      if (posted) this.observedCost[endpoint] = Math.max(batchCost / posted / units, ESTIMATED_COST[endpoint] / 10)
      if (fit < Math.min(BATCH, jobs.length - i)) break
    }
    if (taskIds.size) this.log(`DataForSEO ${endpoint}: ${taskIds.size} task(s) posted, $${this.spent.toFixed(4)} spent so far${this.simulated ? ' (simulated)' : ''}`)

    if (this.opts.fixtureDir) {
      for (const tag of taskIds.keys()) out.set(tag, await this.readFixture<T>(endpoint, tag))
      return out
    }
    const pending = new Set(taskIds.keys())
    const deadline = Date.now() + (this.opts.timeoutMs ?? 25 * 60_000)
    const interval = this.opts.pollIntervalMs ?? 10_000
    while (pending.size && Date.now() < deadline) {
      for (const tag of [...pending]) {
        try {
          const r = await fetch(`${BASE}${ENDPOINTS[endpoint].path}/task_get/advanced/${taskIds.get(tag)}`, { headers: this.headers })
          const t = (await r.json() as DfsEnvelope<T>).tasks?.[0]
          if (t?.status_code === 20000) { out.set(tag, { result: t.result?.[0]?.items ?? [] }); pending.delete(tag) }
          else if (t?.status_code !== 40602 && t?.status_code !== 40601) { out.set(tag, { result: null, error: `task_get ${t?.status_code} ${t?.status_message}` }); pending.delete(tag) }
        } catch { /* transient: retry on the next poll */ }
      }
      if (pending.size) { this.log(`  … ${taskIds.size - pending.size}/${taskIds.size} ready`); await new Promise((r) => setTimeout(r, interval)) }
    }
    for (const tag of pending) out.set(tag, { result: null, error: 'timed out waiting for the task' })
    return out
  }

  private async readFixture<T>(endpoint: Endpoint, tag: string): Promise<{ result: T[] | null; error?: string }> {
    const file = path.join(this.opts.fixtureDir!, 'dataforseo', endpoint, `${tag}.json`)
    let env: DfsEnvelope<T>
    try { env = JSON.parse(await fs.readFile(file, 'utf8')) } catch { return { result: null, error: `no fixture (${path.relative(process.cwd(), file)})` } }
    const t = env.tasks?.[0]
    if (t?.status_code !== 20000) return { result: null, error: `task_get ${t?.status_code} ${t?.status_message}` }
    return { result: t.result?.[0]?.items ?? [] }
  }
}

export const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80)

/** A specification value by name (case-insensitive), e.g. "Brand", "GTIN", "Model". */
export function spec(item: DfsProductInfo | null | undefined, ...names: string[]): string | undefined {
  const wanted = names.map((n) => n.toLowerCase())
  return item?.specifications?.find((s) => wanted.includes(String(s.specification_name ?? '').toLowerCase()))?.specification_value ?? undefined
}
