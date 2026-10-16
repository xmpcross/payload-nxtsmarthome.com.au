/**
 * Run reports (JSON + Markdown under app/scratch/price-runs/) and the run lock.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Change, ProductPlan } from './plan'
import { summarise } from './plan'

export const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
export const RUNS_DIR = path.join(APP_DIR, 'scratch', 'price-runs')
const LOCK = path.join(RUNS_DIR, 'prices.lock')

export interface SearchCandidate {
  rank: number
  title: string
  brand: string | null
  googleProductId: string | null
  dataDocId: string | null
  gtin: string | null
  listingPrice: number | null
  listingSeller: string | null
  auOfferCount: number | null
  auPriceMin: number | null
  auPriceMax: number | null
  auRetailers: string[]
  inCatalogue: { slug: string; by: string } | null
  note?: string
}

export interface FillCandidate { product: string; retailer: string; title: string; url: string; reason: string; price?: number | null }

export interface RunReport {
  command: string
  args: string[]
  startedAt: string
  finishedAt?: string
  mode: 'review' | 'write'
  fixture: string | null
  cost: {
    dataforseo?: { spentUsd: number; tasks: number; maxCostUsd: number; simulated: boolean; notPostedForBudget: string[] }
    zenrows?: { requests: number; credits: number; failures: number; maxRequests: number; simulated: boolean }
  }
  warnings: string[]
  summary?: ReturnType<typeof summarise>
  plans?: ProductPlan[]
  search?: { query: string; candidates: SearchCandidate[] }
  fillCandidates?: FillCandidate[]
  written?: { offersUpdated: number; offersAdded: number; pricesCleared: number; productsUpdated: number; errors: string[] }
}

/** Exclusive lock so a cron `refresh --write` cannot overlap a manual run. Stale locks (dead pid) are taken over. */
export function acquireLock(command: string): () => void {
  fs.mkdirSync(RUNS_DIR, { recursive: true })
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const fd = fs.openSync(LOCK, 'wx')
      fs.writeSync(fd, JSON.stringify({ pid: process.pid, command, at: new Date().toISOString() }))
      fs.closeSync(fd)
      let released = false
      const release = () => { if (!released) { released = true; try { fs.unlinkSync(LOCK) } catch { /* already gone */ } } }
      process.once('exit', release)
      return release
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e
      let holder: { pid?: number; command?: string; at?: string } = {}
      try { holder = JSON.parse(fs.readFileSync(LOCK, 'utf8')) } catch { /* unreadable: treat as stale */ }
      let alive = false
      if (holder.pid) { try { process.kill(holder.pid, 0); alive = true } catch (err) { alive = (err as NodeJS.ErrnoException).code === 'EPERM' } }
      if (alive) throw new Error(`Another price run is in progress (pid ${holder.pid}, ${holder.command}, since ${holder.at}). Lock: ${LOCK}`)
      fs.unlinkSync(LOCK)
    }
  }
  throw new Error(`Could not acquire ${LOCK}`)
}

const money = (n: number | null | undefined) => (typeof n === 'number' ? `$${n.toFixed(2)}` : '—')

export function describeChange(c: Change): string {
  switch (c.kind) {
    case 'update': return `UPDATE   ${c.retailer}: ${money(c.oldPrice)} → ${money(c.newPrice)}${c.newUrl ? ` (+ direct URL)` : ''} [${c.source}${c.verify ? ' verify' : ''}]`
    case 'verified': return `${c.verify ? 'VERIFIED' : 'CHECKED '} ${c.retailer}: ${money(c.price)} unchanged [${c.source}]${c.availability && c.availability !== 'in_stock' ? ` (${c.availability})` : ''}`
    case 'add': return `ADD      ${c.retailer}: ${money(c.price)} ${c.url} [${c.source}]`
    case 'hold': return `HOLD     ${c.retailer}: ${money(c.oldPrice)} → ${money(c.newPrice)} — ${c.note}`
    case 'stale': return `STALE    ${c.retailer}: ${money(c.price)} last checked ${c.lastChecked.slice(0, 10)} (${c.ageDays} days)${c.drop ? ' — price will be CLEARED' : ' — report only (--drop-stale clears it)'}`
    case 'skip': return `skip     ${c.retailer}: ${c.reason}${c.price != null ? ` (${money(c.price)})` : ''}`
  }
}

export function renderMarkdown(r: RunReport): string {
  const lines: string[] = []
  lines.push(`# Price run: ${r.command} (${r.mode === 'write' ? 'WRITE' : 'review only — nothing saved'})`, '')
  lines.push(`- Started: ${r.startedAt}`, `- Finished: ${r.finishedAt ?? '—'}`, `- Arguments: \`${r.args.join(' ') || '(none)'}\``)
  if (r.fixture) lines.push(`- **Fixture mode**: responses read from \`${r.fixture}\` (synthetic data; costs simulated)`)
  if (r.cost.dataforseo) {
    const d = r.cost.dataforseo
    lines.push(`- DataForSEO: ${d.tasks} task(s), $${d.spentUsd.toFixed(4)} of $${d.maxCostUsd} budget${d.simulated ? ' (simulated)' : ''}${d.notPostedForBudget.length ? `; ${d.notPostedForBudget.length} not posted (budget)` : ''}`)
  }
  if (r.cost.zenrows) {
    const z = r.cost.zenrows
    lines.push(`- ZenRows: ${z.requests}/${z.maxRequests} request(s), ${z.credits} credit(s), ${z.failures} failed${z.simulated ? ' (simulated)' : ''}`)
  }
  if (r.summary) {
    const s = r.summary
    lines.push('', '## Summary', '', '| Products | With results | Updates | Checked/verified | Adds | Held | Stale | Stale cleared | Skipped | Product price changes |',
      '|---|---|---|---|---|---|---|---|---|---|',
      `| ${s.products} | ${s.observed} | ${s.updates} | ${s.verified} | ${s.adds} | ${s.held} | ${s.stale} | ${s.staleDropped} | ${s.skipped} | ${s.productPriceChanges} |`)
  }
  if (r.written) {
    lines.push('', '## Written to Payload', '', `Offers updated ${r.written.offersUpdated}, offers added ${r.written.offersAdded}, prices cleared ${r.written.pricesCleared}, products updated ${r.written.productsUpdated}.`)
    for (const e of r.written.errors) lines.push(`- ERROR: ${e}`)
  }
  if (r.warnings.length) { lines.push('', '## Warnings', ''); for (const w of r.warnings) lines.push(`- ${w}`) }
  if (r.plans?.length) {
    lines.push('', '## Products', '')
    for (const p of r.plans) {
      const price = p.newPriceAud !== p.oldPriceAud ? `${money(p.oldPriceAud)} → **${money(p.newPriceAud)}**` : money(p.oldPriceAud)
      lines.push(`### ${p.name} (\`${p.slug}\`) — ${price}`)
      if (p.note) lines.push(`_${p.note}_`)
      if (!p.changes.length) lines.push('- no changes')
      for (const c of p.changes) lines.push(`- ${describeChange(c).replace(/\s{2,}/g, ' ')}`)
      lines.push('')
    }
  }
  if (r.fillCandidates?.length) {
    lines.push('', '## Gap-fill candidates (not written — identity not confirmed)', '', '| Product | Retailer | Title | Reason | URL |', '|---|---|---|---|---|')
    for (const c of r.fillCandidates) lines.push(`| ${c.product} | ${c.retailer} | ${c.title.replace(/\|/g, '/')} | ${c.reason} | ${c.url} |`)
  }
  if (r.search) {
    lines.push('', `## Search: "${r.search.query}"`, '', '| # | Title | Brand | AU price range | AU offers | Google product id | GTIN | In catalogue |', '|---|---|---|---|---|---|---|---|')
    for (const c of r.search.candidates) {
      const range = c.auPriceMin != null ? (c.auPriceMin === c.auPriceMax ? money(c.auPriceMin) : `${money(c.auPriceMin)}–${money(c.auPriceMax)}`) : `${money(c.listingPrice)} (listing)`
      lines.push(`| ${c.rank} | ${c.title.replace(/\|/g, '/')} | ${c.brand ?? '—'} | ${range} | ${c.auOfferCount ?? 'n/a'}${c.auRetailers.length ? ` (${c.auRetailers.join(', ')})` : ''} | ${c.googleProductId ?? `docid ${c.dataDocId ?? '—'}`} | ${c.gtin ?? '—'} | ${c.inCatalogue ? `yes: ${c.inCatalogue.slug} (${c.inCatalogue.by})` : 'no'} |`)
    }
    const notes = r.search.candidates.filter((c) => c.note)
    if (notes.length) { lines.push(''); for (const c of notes) lines.push(`- #${c.rank}: ${c.note}`) }
  }
  return `${lines.join('\n')}\n`
}

export function saveReport(r: RunReport): { json: string; md: string } {
  fs.mkdirSync(RUNS_DIR, { recursive: true })
  const stamp = r.startedAt.replace(/[:.]/g, '-')
  const base = path.join(RUNS_DIR, `${stamp}-${r.command}${r.fixture ? '-fixture' : ''}`)
  fs.writeFileSync(`${base}.json`, `${JSON.stringify(r, null, 2)}\n`)
  fs.writeFileSync(`${base}.md`, renderMarkdown(r))
  return { json: `${base}.json`, md: `${base}.md` }
}

export function latestReport(): string | null {
  if (!fs.existsSync(RUNS_DIR)) return null
  const files = fs.readdirSync(RUNS_DIR).filter((f) => f.endsWith('.md')).sort()
  return files.length ? path.join(RUNS_DIR, files[files.length - 1]) : null
}
