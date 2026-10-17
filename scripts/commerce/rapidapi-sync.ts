// Price history + reviews from RapidAPI "Real-Time Product Search" (Google Shopping, country=au).
//
// Two stages, so nothing is saved until the matches have been looked at:
//
//   fetch  [--slug a,b] [--limit N] [--max-requests N] [--refetch]
//       Calls the API (search -> price history -> first page of reviews, up to 3 requests per
//       product) and stores each answer in scratch/rapidapi-cache/<slug>.json. Resumable: a
//       product that already has a cache file is skipped unless --refetch. Writes nothing to Payload.
//       Counts against the monthly cap in lib/rapidapi.ts (10,000, 100 held in reserve).
//
//   apply  [--slug a,b] [--write]
//       Reads the cache (no API requests) and saves, only with --write:
//         offers[].sourceData.history   daily prices for the last 90 days, merged: our own recorded
//                                       days win, imported days fill the gaps
//         products[].reviews            first-page reviews from every country, appended after the
//                                       existing ones, duplicates skipped (the site still only DISPLAYS
//                                       reviews from allow-listed Australian sources: lib/review-sources.ts)
//       Without --write it prints what it would save.
//
//   status   prints the request count and what the cap allows. No request is sent.
//
//   tsx --env-file=.env.local scripts/commerce/rapidapi-sync.ts <fetch|apply|status> [options]

import fs from 'node:fs'
import path from 'node:path'
import { getPayload } from 'payload'
import config from '../../payload.config'
import { RapidApiCapReached, RapidApiClient } from './lib/rapidapi'
import { attachHistories, mapReviews, mergeHistory, mergeReviews, pickCandidate, searchQuery, type ApiHistoryOffer, type ApiReview, type SearchHit } from './lib/rapidapi-sync'
import { loadCatalogue, loadMerchants, type CatalogueProduct } from './lib/store'
import { mergeSourceData } from './lib/plan'

const argv = process.argv.slice(2)
const command = argv[0]
const flag = (n: string) => argv.includes(`--${n}`)
const opt = (n: string) => { const i = argv.indexOf(`--${n}`); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : undefined }
const CACHE = path.resolve(process.cwd(), 'scratch/rapidapi-cache')
const cachePath = (slug: string) => path.join(CACHE, `${slug.replace(/[^a-z0-9-]/gi, '_')}.json`)
const context = { skipRevalidation: true }

interface CacheEntry {
  slug: string; fetchedAt: string; query: string
  match: { id: string; title: string; by?: string } | null
  tried?: { title: string; reason: string }[]
  historyOffers?: ApiHistoryOffer[]
  reviews?: ApiReview[]; reviewsTotal?: number
  error?: string
}

async function fetchStage() {
  const client = new RapidApiClient({ maxRequests: opt('max-requests') ? Number(opt('max-requests')) : undefined, log: console.log })
  const payload = await getPayload({ config })
  const catalogue = (await loadCatalogue(payload, await loadMerchants(payload))).filter((p) => p.active)
  const only = opt('slug')?.split(',')
  let todo = catalogue.filter((p) => (!only || only.includes(p.slug)) && (flag('refetch') || !fs.existsSync(cachePath(p.slug))))
  if (opt('limit')) todo = todo.slice(0, Number(opt('limit')))
  fs.mkdirSync(CACHE, { recursive: true })
  const first = client.status()
  console.log(`${todo.length} product(s) to fetch · cap ${first.cap}, reserve ${first.reserve} · ${first.allowance.allowed ? `room for about ${first.allowance.left ?? 'the first request'} more request(s)` : `BLOCKED: ${first.allowance.reason}`}`)

  let done = 0, matched = 0, noMatch = 0, failed = 0, stopped = ''
  let next = 0
  async function worker() {
    while (!stopped) {
      const p = todo[next++]
      if (!p) return
      const entry: CacheEntry = { slug: p.slug, fetchedAt: new Date().toISOString(), query: searchQuery(p), match: null }
      try {
        const s = await client.get<{ data?: { products?: SearchHit[] } }>('/search', { q: entry.query, country: 'au', language: 'en', limit: 8 })
        const pick = pickCandidate(p, s.data?.products ?? [])
        entry.tried = pick.tried.slice(0, 4)
        if (pick.hit) {
          entry.match = { id: pick.hit.product_id, title: pick.hit.product_title, by: pick.by }
          const h = await client.get<{ data?: { offers?: ApiHistoryOffer[] } }>('/product-price-history-v2', { product_id: pick.hit.product_id, country: 'au', language: 'en' })
          entry.historyOffers = (h.data?.offers ?? []).map((o) => ({ store_name: o.store_name, offer_page_url: o.offer_page_url, price: o.price, price_history: o.price_history }))
          const r = await client.get<{ data?: { reviews?: ApiReview[]; product_num_reviews?: number } }>('/product-reviews', { product_id: pick.hit.product_id, country: 'au', language: 'en', limit: 100 })
          entry.reviews = r.data?.reviews ?? []
          entry.reviewsTotal = r.data?.product_num_reviews
          matched++
        } else noMatch++
        done++
      } catch (e) {
        if (e instanceof RapidApiCapReached) { stopped = (e as Error).message; return }
        entry.error = (e as Error).message; failed++
        console.log(`  FAILED ${p.slug}: ${entry.error}`)
        if (failed >= 8 && failed > done / 4) { stopped = 'too many failures; stopping'; return }
      }
      if (!entry.error) fs.writeFileSync(cachePath(p.slug), JSON.stringify(entry))
      if ((done + failed) % 25 === 0) console.log(`  ${done} done · ${matched} matched · ${noMatch} no confident match · ${client.sent} requests this run`)
    }
  }
  await Promise.all(Array.from({ length: 3 }, worker))
  const after = client.status()
  console.log(`\nFetched ${done}: ${matched} matched, ${noMatch} without a confident match, ${failed} failed · ${client.sent} request(s) sent this run${stopped ? ` · STOPPED: ${stopped}` : ''}`)
  console.log(`Plan: ${after.state.remaining ?? '?'} of ${after.state.limit ?? '?'} requests left in RapidAPI's count`)
  process.exit(failed && !done ? 1 : 0)
}

async function applyStage() {
  const write = flag('write')
  const payload = await getPayload({ config })
  const catalogue = (await loadCatalogue(payload, await loadMerchants(payload))).filter((p) => p.active)
  const only = opt('slug')?.split(',')
  const bySlug = new Map<string, CatalogueProduct>(catalogue.map((p) => [p.slug, p]))
  const files = fs.existsSync(CACHE) ? fs.readdirSync(CACHE).filter((f) => f.endsWith('.json')) : []
  const today = new Date()
  const tally = { products: 0, noMatch: 0, offersWithHistory: 0, historyPoints: 0, reviewsAdded: 0, productsWithNewReviews: 0, skippedHistory: {} as Record<string, number>, errors: [] as string[] }
  const noMatchList: string[] = [], rows: string[] = []

  for (const f of files) {
    const entry = JSON.parse(fs.readFileSync(path.join(CACHE, f), 'utf8')) as CacheEntry
    if (only && !only.includes(entry.slug)) continue
    const p = bySlug.get(entry.slug)
    if (!p) continue
    tally.products++
    if (!entry.match) { tally.noMatch++; noMatchList.push(entry.slug); continue }

    const { attach, skipped } = attachHistories(p.offers, entry.historyOffers ?? [], today)
    for (const s of skipped) tally.skippedHistory[s.reason.replace(/\$[\d.,]+/g, '$').replace(/ \d+$/, '')] = (tally.skippedHistory[s.reason.replace(/\$[\d.,]+/g, '$').replace(/ \d+$/, '')] ?? 0) + 1
    const incoming = mapReviews(entry.reviews ?? [])
    let reviewsAdded = 0
    try {
      for (const a of attach) {
        const fresh = await payload.findByID({ collection: 'offers', id: a.offerId, depth: 0, overrideAccess: true })
        const history = mergeHistory((fresh.sourceData as Record<string, unknown> | null)?.history, a.points)
        const sourceData = mergeSourceData(fresh.sourceData, { history, historyImportedAt: today.toISOString(), historySource: 'rapidapi-product-search' })
        if (!sourceData) { tally.errors.push(`offer #${a.offerId}: sourceData is not an object; left alone`); continue }
        if (write) await payload.update({ collection: 'offers', id: a.offerId, data: { sourceData }, depth: 0, overrideAccess: true, context })
        tally.offersWithHistory++; tally.historyPoints += a.points.length
      }
      if (incoming.length) {
        const fresh = await payload.findByID({ collection: 'products', id: p.id, depth: 0, overrideAccess: true })
        const { merged, added } = mergeReviews(fresh.reviews, incoming)
        reviewsAdded = added
        if (added) {
          const sourceData = mergeSourceData(fresh.sourceData, { reviewsImportedAt: today.toISOString(), reviewsSource: 'rapidapi-product-search' })
          if (write) await payload.update({ collection: 'products', id: p.id, data: { reviews: merged, ...(sourceData ? { sourceData } : {}) } as any, depth: 0, overrideAccess: true, context })
          tally.reviewsAdded += added; tally.productsWithNewReviews++
        }
      }
    } catch (e) { tally.errors.push(`${entry.slug}: ${(e as Error).message}`) }
    rows.push(`${entry.slug.slice(0, 44).padEnd(44)} -> ${String(entry.match.title).slice(0, 38).padEnd(38)} | history: ${attach.map((a) => `${a.retailer} ${a.points.length}d`).join(', ') || 'none'} | reviews +${reviewsAdded}`)
  }
  console.log(rows.slice(0, 40).join('\n'))
  if (rows.length > 40) console.log(`... ${rows.length - 40} more`)
  console.log(`\n${write ? 'SAVED' : 'DRY RUN (nothing saved; add --write)'}: ${JSON.stringify({ ...tally, errors: tally.errors.length })}`)
  for (const e of tally.errors.slice(0, 10)) console.log('  error:', e)
  fs.writeFileSync(path.join(CACHE, '_apply-report.txt'), `${rows.join('\n')}\n\nno confident match (${noMatchList.length}):\n${noMatchList.join('\n')}\n`)
  process.exit(tally.errors.length ? 1 : 0)
}

function statusStage() {
  const s = new RapidApiClient().status()
  console.log(JSON.stringify({ cap: s.cap, reserve: s.reserve, planLimit: s.state.limit, remainingPerRapidApi: s.state.remaining, resetsAt: s.state.resetAt ? new Date(s.state.resetAt).toISOString() : null, mayRequest: s.allowance.allowed, reason: s.allowance.reason, cachedProducts: fs.existsSync(CACHE) ? fs.readdirSync(CACHE).filter((f) => f.endsWith('.json')).length : 0 }, null, 1))
}

if (command === 'fetch') fetchStage()
else if (command === 'apply') applyStage()
else if (command === 'status') statusStage()
else { console.error('usage: rapidapi-sync.ts <fetch|apply|status> [--slug a,b] [--limit N] [--max-requests N] [--refetch] [--write]'); process.exit(2) }
