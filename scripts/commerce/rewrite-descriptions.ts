// Rewrite product descriptions from the data already on each product, user request 17 Oct 2026.
//
// For inactive products (by default), writes an original description from the
// existing description, "About this item" points and specifications only:
//   cmsDescriptionHtml  overview + key features (shown in the Description tab)
//   shortDescription    55-75 words
//   bestFor             the "Suits:" line, at most 16 words
//   descriptionRewrite  model, date, sources, previous short description / best-for
// The imported `description` is left untouched as the source.
//
//   bash scripts/rewrite-descriptions.sh                 # preview 3, nothing saved
//   bash scripts/rewrite-descriptions.sh --limit 10      # preview 10
//   bash scripts/rewrite-descriptions.sh --write         # rewrite all inactive products
//   bash scripts/rewrite-descriptions.sh --slug <slug> --write
//   bash scripts/rewrite-descriptions.sh --slug a,b,c --research --write
//
// --research: a product with too little stored data (the ones otherwise
// skipped) is researched on the web first (OpenRouter web search, manufacturer
// pages preferred, ~US$0.06 each) and written from those facts only; the
// pages used are recorded in descriptionRewrite.sources.
//
// Rules follow scripts/write-product-blurbs.mjs (5 Oct 2026): only stated
// facts, claims attributed to the brand, no prices, ratings, test claims or
// comparisons, Australian English.

import fs from 'node:fs';
import path from 'node:path';
import { getPayload } from 'payload';
import config from '../../payload.config';
// Plain ESM module shared with the article writer.
import { parseAiJson } from '../writer/parse-ai-json.mjs';
import { researchWithOpenRouter } from '../writer/content-rules.mjs';

type Json = Record<string, any>;
const argv = process.argv.slice(2);
const flag = (n: string) => argv.includes(`--${n}`);
const opt = (n: string, d?: string) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d;
};
const WRITE = flag('write');
const LIMIT = Number(opt('limit', WRITE ? '100000' : '3'));
const ONLY = opt('slug');
const INCLUDE_DONE = flag('redo');
const RESEARCH = flag('research');
const { OPENROUTER_API_KEY } = process.env;
const MODEL = process.env.OPENROUTER_REWRITE_MODEL || process.env.OPENROUTER_MODEL || 'anthropic/claude-sonnet-4.5';
if (!OPENROUTER_API_KEY) {
  console.error('OPENROUTER_API_KEY is not set in app/.env.local.');
  process.exit(1);
}

const SYSTEM = `You write product descriptions for an independent Australian smart-home site. The site researches products; it does not test them.
Rules, all strict:
- Use ONLY facts stated in the product text and specifications you are given. Add nothing else: no prices, no ratings or review scores, no test or hands-on claims ("we tested", "in our testing"), no comparisons with other products, no availability or delivery claims.
- Attribute capability and performance claims to the brand ("the brand says", "according to the manufacturer", "it is listed with"). Do not state them as verified fact.
- Use a specification only where it does not contradict the product text. If the two disagree, leave the point out.
- Write original sentences; do not copy the source text or its marketing slogans. No ALL CAPS, no hype, no superlatives, no exclamation marks.
- Australian English (colour, optimise, centre, metres). Mention 230V, plug type, local app regions or Australian standards ONLY if the data states them.
- Plain HTML only, using <h3>, <p>, <ul>, <li>, <strong>. No links, no images, no inline styles, no markdown.

Return JSON with exactly these keys:
- "descriptionHtml": an <h3>Overview</h3> with 2 short paragraphs (what it is, who it is for, how it is set up or used), then <h3>Key features</h3> with a <ul> of 4 to 6 <li> items, each starting with a short <strong>label</strong> followed by the detail. 170 to 260 words in total.
- "shortDescription": 55 to 75 words, one paragraph, plain text. The first sentence names the product and says what it is.
- "bestFor": one line, at most 16 words, who it suits, derived only from the stated features. No full stop.`;

const BANNED = [/\$\s?\d/, /\bwe (tested|tried|found)\b/i, /\bin our (test|testing|experience)\b/i, /\b\d(\.\d)?\s*(out of 5|\/\s?5|stars?)\b/i, /\b(customer|user|star|review) (rating|score)s?\b/i, /\bbest\b/i, /!/, /\b(color|optimize|center|meters)\b/i];

function words(t: unknown) {
  return String(t ?? '').replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
}
function sourceOf(p: Json) {
  const about: string[] = p.sourceData?.aboutThisItem || [];
  const specs = (p.specifications || []).filter((s: Json) => s?.name && s?.value).slice(0, 40).map((s: Json) => `${s.name}: ${s.value}`);
  return {
    text: [p.description || '', about.length && !String(p.description || '').includes(about[0]?.slice(0, 40)) ? `About this item:\n- ${about.join('\n- ')}` : ''].filter(Boolean).join('\n\n').slice(0, 6000),
    specs,
  };
}
function problems(out: Json): string[] {
  const issues: string[] = [];
  const all = `${out.descriptionHtml} ${out.shortDescription} ${out.bestFor}`;
  for (const re of BANNED) if (re.test(all.replace(/<[^>]+>/g, ' '))) issues.push(`matches ${re}`);
  const dw = words(out.descriptionHtml), sw = words(out.shortDescription), bw = words(out.bestFor);
  if (dw < 140 || dw > 320) issues.push(`description ${dw} words`);
  if (sw < 45 || sw > 90) issues.push(`short description ${sw} words`);
  if (bw < 3 || bw > 18) issues.push(`bestFor ${bw} words`);
  if (!/<h3>Overview<\/h3>/.test(out.descriptionHtml) || !/<h3>Key features<\/h3>/.test(out.descriptionHtml) || !/<li>/.test(out.descriptionHtml)) issues.push('missing Overview / Key features structure');
  if (/<(?!\/?(h3|p|ul|li|strong)\b)[a-z]/i.test(out.descriptionHtml)) issues.push('unexpected HTML tag');
  return issues;
}

let spent = 0;
async function research(p: Json) {
  const name = `${p.brand && !String(p.name).startsWith(p.brand) ? `${p.brand} ` : ''}${p.name}`;
  const r = await researchWithOpenRouter({
    apiKey: OPENROUTER_API_KEY,
    model: MODEL,
    maxResults: 6,
    log: () => {},
    // Perplexity: Exa searched on the whole instruction text and returned unrelated
    // pages; 'native' returned no citations (tested 17 Oct 2026).
    engine: 'perplexity',
    prompt: `${name} specifications and features (manufacturer product page). Report only what the pages state; no prices, ratings or reviews.`,
  });
  spent += Number(r.usage?.cost || 0);
  const facts = (r.json.facts as Json[]).filter((f) => f.url && !/\$\s?\d|\brating|\breview/i.test(f.fact));
  return { text: facts.map((f) => `- ${f.fact}`).join('\n'), urls: [...new Set(facts.map((f) => String(f.url)))] };
}

async function rewrite(p: Json, researched?: { text: string }): Promise<Json> {
  const stored = sourceOf(p);
  const { specs } = stored;
  const text = researched ? `Facts from the manufacturer and specification pages:\n${researched.text}${stored.text ? `\n\n${stored.text}` : ''}` : stored.text;
  const user = `Product: ${p.brand ? `${p.brand} ` : ''}${p.name}\nCategory: ${p.categoryName || ''}${p.subCategory ? ` / ${p.subCategory}` : ''}\n\nProduct text:\n${text || '(none)'}\n\nSpecifications:\n${specs.join('\n') || '(none)'}`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${OPENROUTER_API_KEY}` },
      body: JSON.stringify({ model: MODEL, max_tokens: 1400, temperature: 0.4, usage: { include: true }, messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: user + (attempt > 1 ? '\n\nYour previous answer broke a rule. Follow every rule exactly.' : '') }] }),
    });
    const json = (await res.json()) as Json;
    if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${JSON.stringify(json).slice(0, 200)}`);
    spent += Number(json.usage?.cost || 0);
    const out = parseAiJson(json.choices?.[0]?.message?.content || '', { providerName: 'OpenRouter' });
    out.bestFor = String(out.bestFor || '').trim().replace(/\.$/, '');
    const issues = problems(out);
    if (!issues.length) return out;
    if (attempt === 3) throw new Error(`rules: ${issues.join('; ')}`);
  }
  throw new Error('unreachable');
}

const payload = await getPayload({ config });
const where: Json = ONLY ? { slug: { in: ONLY.split(',') } } : { active: { equals: false } };
const docs = ((await payload.find({ collection: 'products', where, limit: 5000, depth: 0, overrideAccess: true })).docs as Json[])
  .filter((p) => ONLY || INCLUDE_DONE || !(p.descriptionRewrite?.approach || '').includes('rewrite-descriptions'));
const runDir = path.resolve(process.cwd(), 'scratch/description-rewrites', new Date().toISOString().replace(/[:.]/g, '-'));
fs.mkdirSync(runDir, { recursive: true });

let done = 0, skipped = 0, failed = 0;
const report: Json[] = [];
console.log(`${docs.length} product(s) to consider · model ${MODEL} · ${WRITE ? 'WRITE' : 'preview'} · limit ${LIMIT}`);
for (const p of docs) {
  if (done + failed >= LIMIT) break;
  const { text, specs } = sourceOf(p);
  let researched: { text: string; urls: string[] } | undefined;
  if (words(text) < 25 && specs.length < 4 && RESEARCH) {
    try {
      researched = await research(p);
    } catch (err: any) {
      console.log(`  research failed for ${p.slug}: ${err.message}`);
    }
    if (researched && researched.urls.length < 1) researched = undefined;
  }
  if (words(text) < 25 && specs.length < 4 && !researched) {
    skipped++;
    report.push({ slug: p.slug, skipped: 'not enough source data (no description and fewer than 4 specs)' });
    continue;
  }
  try {
    const out = await rewrite(p, researched);
    if (researched) out.sources = researched.urls;
    done++;
    report.push({ slug: p.slug, name: p.name, ...out });
    if (!WRITE) {
      console.log(`\n=== ${p.brand ? p.brand + ' ' : ''}${p.name}\nbestFor: ${out.bestFor}\nshort: ${out.shortDescription}\n${out.descriptionHtml}`);
      continue;
    }
    await payload.update({
      collection: 'products',
      id: p.id,
      data: {
        cmsDescriptionHtml: out.descriptionHtml,
        shortDescription: out.shortDescription,
        bestFor: out.bestFor,
        descriptionRewrite: {
          date: new Date().toISOString().slice(0, 10),
          model: MODEL,
          sources: researched ? researched.urls : ['product description', 'About this item', 'catalogue specifications'],
          approach: researched
            ? 'rewrite-descriptions.ts --research: written only from facts on the manufacturer/specification pages listed in sources (OpenRouter web search), claims attributed to the brand, rule-checked; no fact check pass'
            : 'rewrite-descriptions.ts: written only from the stored description and specifications, claims attributed to the brand, rule-checked; no fact check pass',
          ...(p.shortDescription ? { previousShortDescription: p.shortDescription } : {}),
          ...(p.bestFor ? { previousBestFor: p.bestFor } : {}),
          ...(p.descriptionRewrite ? { previous: p.descriptionRewrite } : {}),
        },
      } as any,
      overrideAccess: true,
      depth: 0,
      context: { skipRevalidation: true },
    });
    if (done % 10 === 0) console.log(`  ${done} rewritten · US$${spent.toFixed(3)}`);
  } catch (err: any) {
    failed++;
    report.push({ slug: p.slug, failed: err.message });
    console.log(`  FAILED ${p.slug}: ${err.message}`);
  }
}
fs.writeFileSync(path.join(runDir, 'report.json'), JSON.stringify(report, null, 1));
console.log(`\n${WRITE ? 'Rewrote' : 'Previewed'} ${done}, skipped ${skipped} (no source data), failed ${failed} · OpenRouter cost US$${spent.toFixed(4)} · report ${runDir}/report.json`);
process.exit(0);
