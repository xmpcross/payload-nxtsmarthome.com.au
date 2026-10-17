/**
 * RapidAPI client for "Real-Time Product Search" with a hard monthly request cap.
 *
 * Why it exists: the plan is metered per request (10,000 a month, user request
 * 17 Oct 2026) and overage must never be billed. Three guards, strictest wins:
 *   1. MONTHLY_CAP (default 10,000, RAPIDAPI_MONTHLY_LIMIT overrides): never use more than
 *      this many requests in one billing period, whatever the plan says.
 *   2. The plan itself: every response carries x-ratelimit-requests-limit/-remaining/-reset,
 *      so the count follows RapidAPI's own billing period, not the calendar month.
 *   3. RESERVE (default 100): requests deliberately left unused, so a retry storm or a
 *      second script running at the same time cannot tip the account into overage.
 * A run may also set maxRequests, which stops that run sooner.
 *
 * State (last known remaining, plan limit, period end) is kept in
 * scratch/rapidapi-usage.json so separate runs share one count. When the period end has
 * passed and no newer header has been seen, the count is treated as unknown-but-fresh and
 * the first response re-syncs it. Before the first-ever response there is no count: the
 * client then allows exactly one request (which reads the headers) before trusting anything.
 *
 * Setting the key: RAPIDAPI_KEY, or OPENWEBNINJA_API_KEY (what this project's .env.local uses
 * for the RapidAPI key). The key never appears in logs or errors.
 *
 * ALSO set "Hard limit" on the plan in the RapidAPI dashboard (Billing / plan settings):
 * this client protects the scripts, the dashboard setting protects the account.
 */
import fs from 'node:fs'
import path from 'node:path'

export const HOST = 'real-time-product-search.p.rapidapi.com'
export const DEFAULT_MONTHLY_CAP = 10_000
export const DEFAULT_RESERVE = 100

export interface UsageState {
  /** Plan limit for the current period, from x-ratelimit-requests-limit. */
  limit: number | null
  /** Requests left in the period per RapidAPI, from x-ratelimit-requests-remaining. */
  remaining: number | null
  /** Epoch ms when the period resets (response time + x-ratelimit-requests-reset seconds). */
  resetAt: number | null
  /** Epoch ms of the last response that carried the headers. */
  syncedAt: number | null
  /** Requests this client has sent since that sync (they are not in `remaining` yet). */
  sentSinceSync: number
}

export const emptyState = (): UsageState => ({ limit: null, remaining: null, resetAt: null, syncedAt: null, sentSinceSync: 0 })

export class RapidApiCapReached extends Error {
  constructor(message: string) { super(message); this.name = 'RapidApiCapReached' }
}

export interface Allowance { allowed: boolean; reason: string; left: number | null }

/**
 * Whether one more request may be sent. Pure: tests drive it directly.
 *   left = min(cap, planLimit) - used, where used comes from RapidAPI's remaining count.
 */
export function allowance(state: UsageState, opts: { cap: number; reserve: number; now: number; sentThisRun: number; maxRequests?: number }): Allowance {
  const { cap, reserve, now, sentThisRun, maxRequests } = opts
  if (maxRequests != null && sentThisRun >= maxRequests) return { allowed: false, reason: `--max-requests ${maxRequests} reached for this run`, left: null }
  if (state.remaining == null || state.limit == null || state.syncedAt == null) {
    // Nothing known yet: one probe request reads the headers; no more until it has.
    return sentThisRun === 0 && state.sentSinceSync === 0
      ? { allowed: true, reason: 'first request of a fresh state (reads the plan headers)', left: null }
      : { allowed: false, reason: 'usage unknown: the previous request returned no rate-limit headers', left: null }
  }
  const periodOver = state.resetAt != null && now >= state.resetAt
  // Period rolled over since the last header: the plan limit applies again, nothing used yet.
  const remaining = periodOver ? state.limit : state.remaining
  const inFlight = periodOver ? 0 : state.sentSinceSync
  const planUsed = state.limit - remaining + inFlight
  const effectiveLimit = Math.min(cap, state.limit)
  const left = effectiveLimit - planUsed - reserve
  if (left <= 0) {
    return { allowed: false, left: 0, reason: `monthly cap: ${planUsed} of ${effectiveLimit} used (cap ${cap}, plan ${state.limit}, reserve ${reserve})${state.resetAt ? `, resets ${new Date(state.resetAt).toISOString().slice(0, 10)}` : ''}` }
  }
  return { allowed: true, left, reason: 'ok' }
}

/** Reads RapidAPI's rate-limit headers; null when they are absent. */
export function parseRateHeaders(h: { get(name: string): string | null }, now: number): Pick<UsageState, 'limit' | 'remaining' | 'resetAt'> | null {
  const num = (n: string) => { const v = h.get(n); return v != null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : null }
  const limit = num('x-ratelimit-requests-limit'), remaining = num('x-ratelimit-requests-remaining'), reset = num('x-ratelimit-requests-reset')
  if (limit == null || remaining == null) return null
  return { limit, remaining, resetAt: reset != null ? now + reset * 1000 : null }
}

export interface RapidApiOptions {
  apiKey?: string
  /** Monthly cap in requests. Default RAPIDAPI_MONTHLY_LIMIT or 10,000. */
  cap?: number
  reserve?: number
  /** Stop this run after this many requests. */
  maxRequests?: number
  statePath?: string
  fetchImpl?: typeof fetch
  log?: (msg: string) => void
  now?: () => number
}

export class RapidApiClient {
  readonly cap: number
  readonly reserve: number
  sent = 0
  private state: UsageState
  private readonly statePath: string
  private readonly apiKey: string
  private readonly fetchImpl: typeof fetch
  private readonly now: () => number

  constructor(private readonly o: RapidApiOptions = {}) {
    this.apiKey = o.apiKey ?? process.env.RAPIDAPI_KEY ?? process.env.OPENWEBNINJA_API_KEY ?? ''
    if (!this.apiKey) throw new Error('No RapidAPI key: set RAPIDAPI_KEY (or OPENWEBNINJA_API_KEY) in app/.env.local.')
    this.cap = o.cap ?? (Number(process.env.RAPIDAPI_MONTHLY_LIMIT) || DEFAULT_MONTHLY_CAP)
    this.reserve = o.reserve ?? DEFAULT_RESERVE
    this.statePath = o.statePath ?? path.resolve(process.cwd(), 'scratch/rapidapi-usage.json')
    this.fetchImpl = o.fetchImpl ?? fetch
    this.now = o.now ?? Date.now
    this.state = this.load()
  }

  private load(): UsageState {
    try { return { ...emptyState(), ...JSON.parse(fs.readFileSync(this.statePath, 'utf8')) } } catch { return emptyState() }
  }
  private save() {
    try { fs.mkdirSync(path.dirname(this.statePath), { recursive: true }); fs.writeFileSync(this.statePath, JSON.stringify(this.state, null, 1)) } catch { /* usage file is advisory */ }
  }

  status(): { state: UsageState; allowance: Allowance; cap: number; reserve: number } {
    this.state = this.load()
    return { state: this.state, allowance: allowance(this.state, { cap: this.cap, reserve: this.reserve, now: this.now(), sentThisRun: this.sent, maxRequests: this.o.maxRequests }), cap: this.cap, reserve: this.reserve }
  }

  /** The first request of a fresh state, while it reads the plan headers; concurrent callers wait for it. */
  private probing: Promise<void> | null = null

  /** One GET. Throws RapidApiCapReached BEFORE sending anything the cap forbids. */
  async get<T = any>(endpoint: string, params: Record<string, string | number>): Promise<T> {
    // Re-read the shared state: another script may have used requests since this one started.
    this.state = this.load()
    if (this.state.syncedAt == null && this.probing) { await this.probing; this.state = this.load() }
    const a = allowance(this.state, { cap: this.cap, reserve: this.reserve, now: this.now(), sentThisRun: this.sent, maxRequests: this.o.maxRequests })
    if (!a.allowed) throw new RapidApiCapReached(a.reason)
    this.sent++
    this.state.sentSinceSync++
    this.save() // counted before sending, so a crash mid-request cannot under-count
    const run = this.send<T>(endpoint, params)
    if (this.state.syncedAt == null && !this.probing) {
      this.probing = run.then(() => undefined, () => undefined).finally(() => { this.probing = null })
    }
    return run
  }

  private async send<T>(endpoint: string, params: Record<string, string | number>): Promise<T> {
    const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]))
    const res = await this.fetchImpl(`https://${HOST}${endpoint}?${qs}`, { headers: { 'x-rapidapi-key': this.apiKey, 'x-rapidapi-host': HOST }, signal: AbortSignal.timeout(60_000) })
    const t = this.now()
    const hdr = parseRateHeaders(res.headers, t)
    if (hdr) { this.state = { ...hdr, syncedAt: t, sentSinceSync: 0 }; this.save() }
    if (res.status === 429) throw new RapidApiCapReached('RapidAPI answered 429: the plan quota is used up; stopping')
    const text = await res.text()
    if (!res.ok) throw new Error(`RapidAPI ${endpoint} HTTP ${res.status}: ${text.replace(this.apiKey, '<key>').slice(0, 200)}`)
    return JSON.parse(text) as T
  }
}
