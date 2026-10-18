#!/usr/bin/env node
/**
 * Draft curated product files (content/products/<slug>.md format) for thin
 * product pages, with Gemini and Google Search grounding.
 *
 * Exception to /opt/CLAUDE.md "all LLM calls go direct to Anthropic": the owner
 * asked for Gemini for this job (6 Oct 2026). Keep it to this script.
 *
 * Drafts only. Output goes to drafts/products/<slug>.md, never content/products/:
 * a curated file there makes the page indexable on the next deploy, so drafts
 * are reviewed first and copied across deliberately.
 *
 *   node --env-file=.env.local scripts/gemini-product-drafts.mjs --limit 3
 *   node --env-file=.env.local scripts/gemini-product-drafts.mjs            all of tiers A and B
 *   node --env-file=.env.local scripts/gemini-product-drafts.mjs --slug <slug> --force
 *
 * Reads the slug list from reports/thin-products.csv (tiers A and B; tier C has
 * too little data to write from). Existing drafts are skipped unless --force.
 * Every draft is checked against the site rules (CLAUDE.md) and the result goes
 * to drafts/products/_report.csv: PASS, or the problems to fix by hand.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'drafts', 'products');
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
// USD per 1M tokens, Gemini 3.8 Flash introductory rate (to 31 Dec 2026). Thinking bills as output.
const PRICE = { input: 0.75, output: 3.75 };
const CONCURRENCY = 4;

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n) => (args.indexOf(n) >= 0 ? args[args.indexOf(n) + 1] : undefined);
const LIMIT = Number(opt('--limit') ?? Infinity);
const ONLY = opt('--slug');
const FORCE = flag('--force');

const KEY = process.env.GEMINI_API_KEY;
if (!KEY) {
  console.error('GEMINI_API_KEY not set (run with --env-file=.env.local)');
  process.exit(1);
}

function readCsv(file) {
  const [head, ...lines] = fs.readFileSync(file, 'utf8').trim().split('\n');
  const cols = head.split(',');
  return lines.map((line) => {
    const cells = [];
    let cur = '';
    let q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (q && c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = !q;
      else if (c === ',' && !q) { cells.push(cur); cur = ''; }
      else cur += c;
    }
    cells.push(cur);
    return Object.fromEntries(cols.map((c, i) => [c, cells[i]]));
  });
}

const catalogue = Object.fromEntries(
  JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'data', 'products.json'), 'utf8')).map((p) => [p.slug, p]),
);
let slugs = ONLY
  ? [ONLY]
  : readCsv(path.join(ROOT, 'reports', 'thin-products.csv'))
      .filter((r) => r.tier !== 'C-empty')
      .map((r) => r.slug);
slugs = slugs.filter((s) => catalogue[s]);
if (!FORCE) slugs = slugs.filter((s) => !fs.existsSync(path.join(OUT, `${s}.md`)));
slugs = slugs.slice(0, LIMIT);

const stripHtml = (s) => String(s ?? '').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim();

function productFacts(p) {
  return {
    name: p.name,
    brand: p.brand,
    category: p.categoryName,
    subCategory: p.subCategory,
    existingBestFor: p.bestFor,
    shortDescription: p.shortDescription,
    description: stripHtml(p.cmsDescriptionHtml || p.description).slice(0, 4000),
    specifications: p.specifications,
    soldAt: (p.retailers || []).map((r) => r.name),
  };
}

const RULES = `You write product notes for nxtsmarthome.com.au, an independent Australian smart-home site.
Readers are Australian homeowners and renters. Write in Australian English (colour, optimise, centre, analyse, licence as a noun).

Hard rules. Breaking any of them makes the draft unusable:
1. Never invent facts. Use only the research notes and catalogue data you are given. Attribute claims ("TP-Link says", "according to the Australian product page"). If the notes do not confirm something, leave it out.
2. We have NOT tested this product. Never write or imply hands-on testing: no "we tested", "in our testing", "we found", "in our experience", "we liked". No star ratings or scores.
3. No prices, no "cheap" or "best price" claims, no stock or sale claims.
4. Electrical work, privacy or surveillance law, and tenancy rules: never state law as settled. Point readers to the official source (e.g. "check your state's electrical safety regulator") and tag any such sentence with [VERIFY].
5. No keyword stuffing, no hype or marketing adjectives ("game-changer", "revolutionary", "seamless", "elevate", "whisper-quiet", "engineered", "sleek", "premium"), no promises about rankings. Plain, factual, attributed.
6. Be genuinely useful: who it suits, who should skip it, and Australia-specific points (plug and voltage, RCM certification, 2.4GHz Wi-Fi, local warranty, platform support such as Matter, Apple Home, Google Home, Alexa, SmartThings, Home Assistant) where the notes confirm them.

Fields:
- bestFor: one sentence, under 30 words: who this suits
- model: model number if confirmed, else empty string
- pros: 3 to 5 specific, attributed, factual points
- cons: 2 to 4 specific, attributed, factual points
- body: markdown, 330 to 450 words: an opening paragraph on what it is, then '## Who it suits' and '## Australian notes' sections. No H1, no sources list, no links.`;

const DRAFT_SCHEMA = {
  type: 'OBJECT',
  properties: {
    bestFor: { type: 'STRING' },
    model: { type: 'STRING' },
    pros: { type: 'ARRAY', items: { type: 'STRING' } },
    cons: { type: 'ARRAY', items: { type: 'STRING' } },
    body: { type: 'STRING' },
  },
  required: ['bestFor', 'model', 'pros', 'cons', 'body'],
};

async function gemini(body) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY },
      body: JSON.stringify(body),
    });
    if (res.status === 429 || res.status >= 500) {
      await new Promise((r) => setTimeout(r, 5000 * 2 ** attempt));
      continue;
    }
    const json = await res.json();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(json).slice(0, 300)}`);
    return json;
  }
  throw new Error('gave up after repeated 429/5xx');
}

/**
 * Step 1, research: a short prompt with Google Search and nothing else. Given
 * the full brief and catalogue data in one call, the model skipped searching
 * on about half the products and wrote from memory; a bare research request
 * searched every time in testing.
 */
const research = (p) =>
  gemini({
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `Search Google for the ${[p.brand, p.name].filter(Boolean).join(' ')} (${p.subCategory || p.categoryName}). Find the manufacturer's product page, Australian if there is one, and Australian retailer listings. List the facts you confirmed as short bullet points, each naming its source site: model number, key specifications, power and plug, Wi-Fi band, smart platforms supported (Matter, Apple Home, Google Home, Alexa, SmartThings, Home Assistant), subscription needs, warranty in Australia, notable limitations. No prices. Say "not found" for anything you could not confirm.`,
          },
        ],
      },
    ],
    tools: [{ google_search: {} }],
  });

/** Step 2, writing: no tools, structured output, only from the research notes. */
const write = (p, notes) =>
  gemini({
    systemInstruction: { parts: [{ text: RULES }] },
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `Research notes from Google Search (the only facts you may state beyond the catalogue data):\n${notes}\n\nCatalogue data (may be incomplete or generic; where it conflicts with the notes, trust the notes):\n${JSON.stringify(productFacts(p), null, 2)}`,
          },
        ],
      },
    ],
    generationConfig: { responseMimeType: 'application/json', responseSchema: DRAFT_SCHEMA },
  });

/** Grounding chunks carry Google redirect URLs; resolve them to the real page. */
async function sourceUrls(json) {
  const chunks = json.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
  const urls = [];
  for (const c of chunks.slice(0, 12)) {
    const uri = c.web?.uri;
    if (!uri) continue;
    let real = uri;
    try {
      const r = await fetch(uri, { redirect: 'manual' });
      real = r.headers.get('location') || uri;
    } catch {}
    if (/vertexaisearch|grounding-api-redirect/.test(real)) continue;
    // Forums, video, social, manual mirrors and US retailers are not product sources (content audit C6).
    if (/^https?:\/\/(?:[^/]*\.)?(?:reddit\.com|youtube\.com|youtu\.be|facebook\.com|manuals\.plus|device\.report|notice-facile\.com|manualslib\.com|bestbuy\.com|bhphotovideo\.com|crutchfield\.com|walmart\.com|homedepot\.com)(?:[/:?#]|$)|^https?:\/\/(?:www\.)?amazon\.com(?:[/:?#]|$)|^https?:\/\/community\./i.test(real)) continue;
    if (!urls.includes(real)) urls.push(real);
  }
  return urls;
}

function parseDraft(text) {
  const t = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  return JSON.parse(t.slice(start, end + 1));
}

const words = (s) => String(s).split(/\s+/).filter(Boolean).length;
const TESTING = /\b(we|I) (tested|found|liked|loved|noticed|used)\b|\bin (our|my) (testing|tests|experience)\b|\bhands-on\b/i;
const US_SPELLING = /\b(color|colors|optimize|optimized|center|analyze|favorite|behavior|gray)\b/i;
const HYPE = /\b(game[- ]changer|revolutionary|seamless(ly)?|elevate|unleash|cutting-edge|whisper-quiet|engineered|sleek)\b/i;
const PRICE_CLAIM = /\$\s?\d|\bAUD\b|\bcheapest\b|\bon sale\b/i;

function check(d, sources) {
  const problems = [];
  const all = [d.bestFor, ...d.pros, ...d.cons, d.body].join(' ');
  // The product's own name can contain US spelling ("White & Color Ambiance").
  const own = all.replaceAll(d.__name, ' ');
  if (!d.bestFor) problems.push('no bestFor');
  if (d.pros.length < 3) problems.push(`${d.pros.length} pros`);
  if (d.cons.length < 2) problems.push(`${d.cons.length} cons`);
  const n = words([d.bestFor, ...d.pros, ...d.cons, d.body].join(' '));
  if (n < 330) problems.push(`${n} words`);
  if (TESTING.test(all)) problems.push(`testing claim: "${all.match(TESTING)[0]}"`);
  if (US_SPELLING.test(own)) problems.push(`US spelling: "${own.match(US_SPELLING)[0]}"`);
  if (HYPE.test(all)) problems.push(`hype: "${all.match(HYPE)[0]}"`);
  if (PRICE_CLAIM.test(all)) problems.push(`price: "${all.match(PRICE_CLAIM)[0]}"`);
  const verify = (all.match(/\[VERIFY\]/g) || []).length;
  if (verify) problems.push(`${verify} [VERIFY] to resolve`);
  if (sources.length === 0) problems.push('UNGROUNDED: no search sources, facts unverified');
  return { words: n, problems };
}

const yamlStr = (s) => `'${String(s).replace(/'/g, "''")}'`;

function render(p, d, sources) {
  const match = [...new Set([p.brand ? `${p.brand} ${p.name}` : '', p.name].filter(Boolean))];
  return `---
name: ${yamlStr(p.name)}
brand: ${yamlStr(p.brand || '')}
bestFor: ${yamlStr(d.bestFor)}
# No \`rating\` — research-based, not hands-on tested. See CLAUDE.md rule 5.
# Draft: ${MODEL} with Google Search grounding, ${new Date().toISOString().slice(0, 10)}. Review before publishing.
match:
${match.map((m) => `  - ${yamlStr(m)}`).join('\n')}
identifiers:
  model: ${yamlStr(d.model || '')}
  asin: ''
  ebayEpid: ''
pros:
${d.pros.map((x) => `  - ${yamlStr(x)}`).join('\n')}
cons:
${d.cons.map((x) => `  - ${yamlStr(x)}`).join('\n')}
---

${d.body.trim()}

## Sources

${sources.map((u) => `- ${u}`).join('\n')}
`;
}

fs.mkdirSync(OUT, { recursive: true });
const REPORT = path.join(OUT, '_report.csv');
if (!fs.existsSync(REPORT)) fs.writeFileSync(REPORT, 'slug,status,words,sources,cost_usd,problems\n');

let cost = 0;
let done = 0;
let passed = 0;
console.log(`${slugs.length} products to draft with ${MODEL}`);

async function one(slug) {
  const p = catalogue[slug];
  try {
    // Research until a search actually happened (up to 3 tries): unsearched
    // notes are model memory, which breaks CLAUDE.md "no invented facts".
    let d;
    let sources = [];
    let notes = '';
    let c = 0;
    let lastErr;
    const tally = (json) => {
      const u = json.usageMetadata ?? {};
      const inTok = (u.promptTokenCount ?? 0) + (u.toolUsePromptTokenCount ?? 0);
      const outTok = (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0);
      c += (inTok * PRICE.input + outTok * PRICE.output) / 1e6;
    };
    const textOf = (json) => (json.candidates?.[0]?.content?.parts ?? []).map((x) => x.text ?? '').join('');
    for (let attempt = 0; attempt < 3 && !sources.length; attempt++) {
      const r = await research(p);
      tally(r);
      notes = textOf(r);
      sources = await sourceUrls(r);
    }
    for (let attempt = 0; attempt < 3 && !d; attempt++) {
      const w = await write(p, sources.length ? notes : '(none: search found nothing)');
      tally(w);
      try {
        d = parseDraft(textOf(w));
      } catch (err) {
        lastErr = err;
      }
    }
    cost += c;
    if (!d) throw lastErr ?? new Error('no usable answer');
    d.pros = Array.isArray(d.pros) ? d.pros : [];
    d.cons = Array.isArray(d.cons) ? d.cons : [];
    d.__name = p.name;
    const { words: n, problems } = check(d, sources);
    fs.writeFileSync(path.join(OUT, `${slug}.md`), render(p, d, sources));
    const status = problems.length ? 'REVIEW' : 'PASS';
    if (!problems.length) passed++;
    fs.appendFileSync(REPORT, `${slug},${status},${n},${sources.length},${c.toFixed(4)},"${problems.join('; ').replace(/"/g, "'")}"\n`);
    console.log(`${String(++done).padStart(3)}/${slugs.length} ${status.padEnd(6)} ${n}w ${sources.length}src $${c.toFixed(4)}  ${slug}${problems.length ? `  (${problems.join('; ')})` : ''}`);
  } catch (err) {
    fs.appendFileSync(REPORT, `${slug},ERROR,,,,"${String(err.message).replace(/"/g, "'").slice(0, 200)}"\n`);
    console.log(`${String(++done).padStart(3)}/${slugs.length} ERROR  ${slug}: ${err.message.slice(0, 200)}`);
  }
}

const queue = [...slugs];
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length) await one(queue.shift());
  }),
);
console.log(`\n${passed}/${slugs.length} passed the checks; cost this run ≈ US$${cost.toFixed(2)}`);
