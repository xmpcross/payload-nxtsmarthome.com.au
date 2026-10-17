import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { allowance, emptyState, parseRateHeaders, RapidApiCapReached, RapidApiClient, type UsageState } from '../lib/rapidapi'

const NOW = 1_000_000_000_000
const st = (o: Partial<UsageState>): UsageState => ({ ...emptyState(), limit: 10000, remaining: 10000, resetAt: NOW + 86_400_000, syncedAt: NOW - 1000, ...o })
const a = (state: UsageState, extra: Partial<Parameters<typeof allowance>[1]> = {}) => allowance(state, { cap: 10000, reserve: 100, now: NOW, sentThisRun: 0, ...extra })

test('allows requests until the cap minus the reserve is used', () => {
  assert.equal(a(st({ remaining: 10000 })).allowed, true)
  assert.equal(a(st({ remaining: 101 })).allowed, true)      // 9,899 used + reserve 100 = 9,999 < 10,000
  assert.equal(a(st({ remaining: 100 })).allowed, false)     // 9,900 used: the reserve is untouchable
  assert.equal(a(st({ remaining: 0 })).allowed, false)
})
test('the 10,000 cap wins when the plan allows more', () => {
  assert.equal(a(st({ limit: 50000, remaining: 40101 })).allowed, true)   // 9,899 used + reserve 100 < 10,000
  assert.equal(a(st({ limit: 50000, remaining: 40100 })).allowed, false)  // 9,900 used: stop, though the plan has 40,100 left
})
test('a plan smaller than the cap is the limit (free plan: 100)', () => {
  assert.equal(a(st({ limit: 100, remaining: 71 })).allowed, false) // reserve 100 >= whole plan: blocked until the plan is upgraded
  assert.equal(allowance(st({ limit: 100, remaining: 71 }), { cap: 10000, reserve: 5, now: NOW, sentThisRun: 0 }).allowed, true)
})
test('requests already sent but not yet reflected in headers count as used', () => {
  assert.equal(a(st({ remaining: 105, sentSinceSync: 4 })).allowed, true)   // 9,895 + 4 = 9,899 used
  assert.equal(a(st({ remaining: 105, sentSinceSync: 5 })).allowed, false)  // 9,895 + 5 = 9,900 used
})
test('--max-requests stops the run first', () => {
  const r = a(st({}), { sentThisRun: 5, maxRequests: 5 })
  assert.equal(r.allowed, false); assert.match(r.reason, /max-requests/)
})
test('unknown usage allows exactly one probe request', () => {
  assert.equal(a(emptyState()).allowed, true)
  assert.equal(a(emptyState(), { sentThisRun: 1 }).allowed, false)
  assert.equal(a({ ...emptyState(), sentSinceSync: 1 }).allowed, false)
})
test('a period that has reset starts again from the plan limit', () => {
  assert.equal(a(st({ remaining: 0, resetAt: NOW - 1 })).allowed, true)
})
test('parses RapidAPI headers', () => {
  const h = new Headers({ 'x-ratelimit-requests-limit': '10000', 'x-ratelimit-requests-remaining': '9990', 'x-ratelimit-requests-reset': '3600' })
  assert.deepEqual(parseRateHeaders(h, NOW), { limit: 10000, remaining: 9990, resetAt: NOW + 3_600_000 })
  assert.equal(parseRateHeaders(new Headers(), NOW), null)
})

function client(remaining: number, cap = 10000) {
  const statePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-')), 'usage.json')
  let calls = 0, left = remaining
  const fetchImpl = (async () => { calls++; left--; return new Response('{"ok":true}', { headers: { 'x-ratelimit-requests-limit': '10000', 'x-ratelimit-requests-remaining': String(left), 'x-ratelimit-requests-reset': '1000' } }) }) as typeof fetch
  const c = new RapidApiClient({ apiKey: 'k', cap, statePath, fetchImpl, reserve: 100, now: () => NOW })
  return { c, calls: () => calls, statePath }
}
test('the client sends nothing once the cap is reached, and never exceeds it', async () => {
  const { c, calls } = client(103)           // probe + a few, then stop at the reserve
  let stopped: unknown
  for (let i = 0; i < 20; i++) { try { await c.get('/search', { q: 'x' }) } catch (e) { stopped = e; break } }
  assert.ok(stopped instanceof RapidApiCapReached)
  assert.ok(calls() <= 4, `sent ${calls()} requests`)
})
test('the key never appears in errors', async () => {
  const statePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-')), 'usage.json')
  const fetchImpl = (async () => new Response('bad SECRETKEY here', { status: 500 })) as typeof fetch
  const c = new RapidApiClient({ apiKey: 'SECRETKEY', statePath, fetchImpl })
  await assert.rejects(() => c.get('/x', {}), (e: Error) => !e.message.includes('SECRETKEY'))
})

test('concurrent first requests wait for the probe instead of stopping', async () => {
  const statePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'rapid-')), 'usage.json')
  let left = 9000, calls = 0
  const fetchImpl = (async () => { calls++; await new Promise((r) => setTimeout(r, 20)); left--; return new Response('{}', { headers: { 'x-ratelimit-requests-limit': '10000', 'x-ratelimit-requests-remaining': String(left), 'x-ratelimit-requests-reset': '1000' } }) }) as typeof fetch
  const c = new RapidApiClient({ apiKey: 'k', statePath, fetchImpl, reserve: 100, now: () => NOW })
  await Promise.all([c.get('/a', {}), c.get('/b', {}), c.get('/c', {})])
  assert.equal(calls, 3)
})
