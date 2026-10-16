/**
 * ZenRows client: fetches retailer pages through Australian premium proxies.
 *
 * - concurrency limit (default 3), retries with backoff on 429 / 5xx / network errors
 * - credit tracking from the X-Request-Cost response header
 * - --max-requests guard: once the budget is used, further calls throw RequestBudgetExceeded
 *   (callers stop and report what was not checked)
 *
 * Fixture mode reads HTML from <fixtureDir>/zenrows/<file> using the key → file map in
 * <fixtureDir>/manifest.json ("zenrows" section). Keys look like "product:Bunnings:<slug>"
 * or "search:JB Hi-Fi:<slug>", so fixtures survive offer URL changes.
 */
import fs from 'node:fs/promises'
import path from 'node:path'

const ENDPOINT = 'https://api.zenrows.com/v1/'

export class RequestBudgetExceeded extends Error {}

export interface ZenRowsOptions {
  apiKey?: string
  maxRequests: number
  concurrency?: number
  retries?: number
  fixtureDir?: string
  fixtureMap?: Record<string, string>
  log?: (msg: string) => void
}

export interface FetchOptions { jsRender?: boolean; fixtureKey?: string; autoparse?: boolean }
export interface FetchResult { ok: boolean; status: number; html: string; credits: number; error?: string; fromFixture?: boolean }

export class ZenRowsClient {
  requests = 0
  credits = 0
  failures = 0
  readonly simulated: boolean
  private active = 0
  private queue: Array<() => void> = []
  private log: (msg: string) => void

  constructor(private opts: ZenRowsOptions) {
    this.simulated = Boolean(opts.fixtureDir)
    this.log = opts.log ?? (() => {})
    if (!opts.fixtureDir && !opts.apiKey) throw new Error('ZENROWS_API_KEY is not set (use --fixture <dir> to run offline)')
  }

  get remaining() { return Math.max(0, this.opts.maxRequests - this.requests) }

  private async slot<T>(fn: () => Promise<T>): Promise<T> {
    const limit = this.opts.concurrency ?? 3
    if (this.active >= limit) await new Promise<void>((r) => this.queue.push(r))
    this.active++
    try { return await fn() } finally { this.active--; this.queue.shift()?.() }
  }

  async fetchHtml(url: string, o: FetchOptions = {}): Promise<FetchResult> {
    // Budget is reserved synchronously so concurrent callers cannot overshoot it.
    if (this.requests >= this.opts.maxRequests) throw new RequestBudgetExceeded(`--max-requests ${this.opts.maxRequests} reached`)
    this.requests++
    return this.slot(async () => {
      if (this.opts.fixtureDir) return this.fromFixture(url, o.fixtureKey)
      const params = new URLSearchParams({ apikey: this.opts.apiKey!, url, premium_proxy: 'true', proxy_country: 'au', antibot: 'true' })
      if (o.jsRender) params.set('js_render', 'true')
      if (o.autoparse) params.set('autoparse', 'true')
      const retries = this.opts.retries ?? 2
      let last: FetchResult = { ok: false, status: 0, html: '', credits: 0, error: 'not attempted' }
      for (let attempt = 0; attempt <= retries; attempt++) {
        if (attempt) await new Promise((r) => setTimeout(r, 1500 * 2 ** (attempt - 1)))
        try {
          const res = await fetch(`${ENDPOINT}?${params}`, { signal: AbortSignal.timeout(90_000) })
          const credits = Number(res.headers.get('x-request-cost') ?? 0) || 0
          this.credits += credits
          const html = await res.text()
          last = { ok: res.ok, status: res.status, html: res.ok ? html : '', credits, error: res.ok ? undefined : `HTTP ${res.status}: ${html.slice(0, 200)}` }
          if (res.ok || (res.status < 500 && res.status !== 429)) break
          this.log(`  ZenRows ${res.status} for ${url}; retrying`)
        } catch (e) {
          last = { ok: false, status: 0, html: '', credits: 0, error: (e as Error).message }
        }
      }
      if (!last.ok) this.failures++
      return last
    })
  }

  private async fromFixture(url: string, key?: string): Promise<FetchResult> {
    const file = (key && this.opts.fixtureMap?.[key]) ?? this.opts.fixtureMap?.[url]
    if (!file) { this.failures++; return { ok: false, status: 404, html: '', credits: 0, error: `no fixture for ${key ?? url}`, fromFixture: true } }
    try {
      const html = await fs.readFile(path.join(this.opts.fixtureDir!, file), 'utf8')
      return { ok: true, status: 200, html, credits: 0, fromFixture: true }
    } catch (e) {
      this.failures++
      return { ok: false, status: 404, html: '', credits: 0, error: `fixture unreadable: ${(e as Error).message}`, fromFixture: true }
    }
  }
}
