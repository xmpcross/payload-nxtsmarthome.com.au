// Rewrite ONLY product.shortDescription, user request 17 Oct 2026.
//
// A short description must not repeat the description: every candidate is
// rejected and retried when more than MAX_COPY of its 5-word phrases already
// appear in the product's description or rewritten description. Nothing else on
// the product changes (not cmsDescriptionHtml, bestFor or description).
//
//   tsx --env-file=.env.local scripts/commerce/rewrite-short-descriptions.ts                 # preview 3, nothing saved
//   tsx ... rewrite-short-descriptions.ts --limit 10                                          # preview 10
//   tsx ... rewrite-short-descriptions.ts --write --max-cost 2.5 --research                   # rewrite all
//   tsx ... rewrite-short-descriptions.ts --slug a,b --write
//
// --research: a product with too little stored data is researched on the web first
// (OpenRouter web search, ~US$0.06 each), as in rewrite-descriptions.ts.
// --max-cost (USD, default 2.5) stops the run before spending more.
// The previous text is kept in descriptionRewrite.shortDescriptionRewrite.previous.
//
// Rules follow rewrite-descriptions.ts: only stated facts, claims attributed to the
// brand, no prices, ratings, test claims or comparisons, Australian English.

import fs from 'node:fs';
import path from 'node:path';
import { getPayload } from 'payload';
import config from '../../payload.config';
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
const RESEARCH = flag('research');
const ONLY = opt('slug');
const LIMIT = Number(opt('limit', WRITE ? '100000' : '3'));
const MAX_COST = Number(opt('max-cost', '2.5'));
const CONCURRENCY = Number(opt('concurrency', '4'));
const MAX_COPY = 0.2;
const { OPENROUTER_API_KEY } = process.env;
const MODEL = process.env.OPENROUTER_SHORT_MODEL || 'anthropic/claude-haiku-4.5';
if (!OPENROUTER_API_KEY) {
  console.error('OPENROUTER_API_KEY is not set in app/.env.local.');
  process.exit(1);
}

const SYSTEM = `You write the short description for a product listing on an independent Australian smart-home site. The site researches products; it does not test them.
Rules, all strict:
- Use ONLY facts stated in the product text and specifications you are given. Add nothing else: no prices, no ratings or review scores, no test or hands-on claims ("we tested", "in our testing"), no comparisons with other products, no availability or delivery claims.
- Attribute capability and performance claims to the brand ("the brand says", "according to the manufacturer", "it is listed with"). Do not state them as verified fact.
- Use a specification only where it does not contradict the product text. If the two disagree, leave the point out.
- Write original sentences in your own words. Do NOT copy phrases from the source text or its marketing slogans, and do not reuse any run of five or more words from it. This text sits next to the full description, so it must read as a different, shorter summary, not an extract.
- No ALL CAPS, no hype, no superlatives, no exclamation marks.
- Australian English (colour, optimise, centre, metres). Mention 230V, plug type, local app regions or Australian standards ONLY if the data states them.
- Plain text only: one paragraph, no HTML, no markdown, no lists.

Return JSON with exactly one key:
- "shortDescription": 55 to 75 words. The first sentence names the product and says what it is.`;

const BANNED = [/\$\s?\d/, /\bwe (tested|tried|found)\b/i, /\bin our (test|testing|experience)\b/i, /\b\d(\.\d)?\s*(out of 5|\/\s?5|stars?)\b/i, /\b(customer|user|star|review) (rating|score)s?\b/i, /\bbest\b/i, /!/, /\b(color|optimize|center|meters)\b/i, /<[a-z][^>]*>/i, /\n/];

const norm = (t: unknown) => String(t ?? '').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const wordsOf = (t: string) => t.split(' ').filter(Boolean);
const wordCount = (t: unknown) => String(t ?? '').replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
const grams = (w: string[]) => new Set(w.slice(0, Math.max(0, w.length - 4)).map((_, i) => w.slice(i, i + 5).join(' ')));

/** Share of the candidate's 5-word phrases that also appear in `other`. */
export function copiedShare(candidate: string, other: string): number {
  const cg = grams(wordsOf(norm(candidate)));
  if (!cg.size) return 0;
  const og = grams(wordsOf(norm(other)));
  return [...cg].filter((g) => og.has(g)).length / cg.size;
}

function sourceOf(p: Json) {
  const about: string[] = p.sourceData?.aboutThisItem || [];
  const specs = (p.specifications || []).filter((s: Json) => s?.name && s?.value).slice(0, 40).map((s: Json) => `${s.name}: ${s.value}`);
  return {
    text: [p.description || '', about.length && !String(p.description || '').includes(about[0]?.slice(0, 40)) ? `About this item:\n- ${about.join('\n- ')}` : ''].filter(Boolean).join('\n\n').slice(0, 6000),
    specs,
  };
}

let spent = 0;
const overBudget = () => spent >= MAX_COST;

async function research(p: Json) {
  const name = `${p.brand && !String(p.name).startsWith(p.brand) ? `${p.brand} ` : ''}${p.name}`;
  const r = await researchWithOpenRouter({
    apiKey: OPENROUTER_API_KEY,
    model: MODEL,
    maxResults: 6,
    log: () => {},
    engine: 'perplexity',
    prompt: `${name} specifications and features (manufacturer product page). Report only what the pages state; no prices, ratings or reviews.`,
  });
  spent += Number(r.usage?.cost || 0);
  const facts = (r.json.facts as Json[]).filter((f) => f.url && !/\$\s?\d|\brating|\breview/i.test(f.fact));
  return { text: facts.map((f) => `- ${f.fact}`).join('\n'), urls: [...new Set(facts.map((f) => String(f.url)))] };
}

function problems(p: Json, short: string): string[] {
  const issues: string[] = [];
  for (const re of BANNED) if (re.test(short)) issues.push(`matches ${re}`);
  const n = wordCount(short);
  if (n < 45 || n > 90) issues.push(`${n} words (want 55-75)`);
  for (const [name, field] of [['description', p.description], ['rewritten description', p.cmsDescriptionHtml]] as const) {
    const share = copiedShare(short, String(field ?? ''));
    if (share > MAX_COPY) issues.push(`${Math.round(share * 100)}% of its phrases copied from the ${name}`);
  }
  if (norm(short) === norm(p.shortDescription)) issues.push('same as the current short description');
  return issues;
}

async function rewrite(p: Json, researched?: { text: string }): Promise<string> {
  const stored = sourceOf(p);
  const text = researched ? `Facts from the manufacturer and specification pages:\n${researched.text}${stored.text ? `\n\n${stored.text}` : ''}` : stored.text;
  const user = `Product: ${p.brand ? `${p.brand} ` : ''}${p.name}\nCategory: ${p.categoryName || ''}${p.subCategory ? ` / ${p.subCategory}` : ''}\n\nProduct text:\n${text || '(none)'}\n\nSpecifications:\n${stored.specs.join('\n') || '(none)'}`;
  let feedback = '';
  for (let attempt = 1; attempt <= 3; attempt++) {
    if (overBudget()) throw new Error(`--max-cost US$${MAX_COST} reached`);
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${OPENROUTER_API_KEY}` },
      body: JSON.stringify({ model: MODEL, max_tokens: 400, temperature: 0.5, usage: { include: true }, messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: user + feedback }] }),
    });
    const json = (await res.json()) as Json;
    if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${JSON.stringify(json).slice(0, 200)}`);
    spent += Number(json.usage?.cost || 0);
    const out = parseAiJson(json.choices?.[0]?.message?.content || '', { providerName: 'OpenRouter' });
    const short = String(out.shortDescription ?? '').trim();
    const issues = problems(p, short);
    if (!issues.length) return short;
    if (attempt === 3) throw new Error(`rules: ${issues.join('; ')}`);
    feedback = `\n\nYour previous answer was rejected: ${issues.join('; ')}. Write it again in entirely different wording, following every rule.`;
  }
  throw new Error('unreachable');
}

async function main() {
  const payload = await getPayload({ config });
  const where: Json = ONLY ? { slug: { in: ONLY.split(',') } } : {};
  const docs = (await payload.find({ collection: 'products', where, limit: 5000, depth: 0, overrideAccess: true })).docs as Json[];
  const runDir = path.resolve(process.cwd(), 'scratch/short-description-rewrites', new Date().toISOString().replace(/[:.]/g, '-'));
  fs.mkdirSync(runDir, { recursive: true });

  let done = 0, skipped = 0, failed = 0, stopped = false, next = 0;
  const report: Json[] = [];
  console.log(`${docs.length} product(s) · model ${MODEL} · ${WRITE ? 'WRITE' : 'preview'} · limit ${LIMIT} · max cost US$${MAX_COST}`);

  async function worker() {
    while (!stopped) {
      const p = docs[next++];
      if (!p || done + failed >= LIMIT) return;
      if (overBudget()) { stopped = true; return; }
      const { text, specs } = sourceOf(p);
      const lacking = wordCount(text) < 25 && specs.length < 4;
      let researched: { text: string; urls: string[] } | undefined;
      if (lacking && RESEARCH) {
        try { researched = await research(p); } catch (err: any) { console.log(`  research failed for ${p.slug}: ${err.message}`); }
        if (researched && researched.urls.length < 1) researched = undefined;
      }
      if (lacking && !researched) { skipped++; report.push({ slug: p.slug, skipped: 'not enough source data' }); continue; }
      try {
        const short = await rewrite(p, researched);
        done++;
        report.push({ slug: p.slug, name: p.name, before: p.shortDescription ?? null, after: short, sources: researched?.urls });
        if (!WRITE) { console.log(`\n=== ${p.brand ? p.brand + ' ' : ''}${p.name}\nbefore: ${p.shortDescription ?? '(none)'}\nafter:  ${short}`); continue; }
        await payload.update({
          collection: 'products', id: p.id, overrideAccess: true, depth: 0, context: { skipRevalidation: true },
          data: {
            shortDescription: short,
            descriptionRewrite: {
              ...(p.descriptionRewrite && typeof p.descriptionRewrite === 'object' ? p.descriptionRewrite : {}),
              shortDescriptionRewrite: {
                date: new Date().toISOString().slice(0, 10), model: MODEL, previous: p.shortDescription ?? null,
                sources: researched ? researched.urls : ['product description', 'About this item', 'catalogue specifications'],
              },
            },
          } as any,
        });
        if (done % 25 === 0) console.log(`  ${done} rewritten · US$${spent.toFixed(3)}`);
      } catch (err: any) {
        failed++;
        report.push({ slug: p.slug, failed: err.message });
        console.log(`  FAILED ${p.slug}: ${err.message}`);
        if (/--max-cost/.test(err.message)) stopped = true;
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  fs.writeFileSync(path.join(runDir, 'report.json'), JSON.stringify(report, null, 1));
  const left = docs.length - Math.min(next, docs.length);
  console.log(`\n${WRITE ? 'Rewrote' : 'Previewed'} ${done}, skipped ${skipped} (no source data), failed ${failed}${stopped ? `, stopped at the cost cap with ~${left} not reached` : ''} · OpenRouter cost US$${spent.toFixed(4)} · report ${runDir}/report.json`);
  process.exit(0);
}
main();
