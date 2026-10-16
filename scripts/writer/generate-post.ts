#!/usr/bin/env node
// NXT Smart Home — AI article generator
//
// Generates smart-home articles for nxtsmarthome.com.au and saves them
// directly to the Payload/PostgreSQL database. Images are generated with
// fal.ai and stored in the site's local media uploads.
//
// Run via run.sh (sets NODE_PATH and env):
//   bash /kspellman/sites/nxtsmarthome.com.au/app/scripts/writer/run.sh [options]
//
// Examples:
//   bash run.sh
//   bash run.sh --category security --count 2
//   bash run.sh "Best smart locks for renters" --category security --post-type buying-guide
//   bash run.sh --category lighting --count 5 --publishedAt "2026-11-01 09:00" --publish-every 24
//   bash run.sh --dry-run --category energy --count 1 --no-images
//   bash run.sh "Smart lock laws for renters" --category security --author adrian-thompson
//
// Byline: --author <slug> names the person who edits and fact-checks the
// draft. Default: the site editor, Kritin Curtis. Never chosen at random.
//
// Categories: security, lighting, energy, entertainment, climate,
//             hubs-and-platforms, robot-vacuums, setup-guides, buying-guides
//
// AI provider: OpenRouter by default (OPENROUTER_API_KEY, OPENROUTER_MODEL);
// run.sh sets AI_PROVIDER=openrouter when it is unset, since the Gemini account
// has no credit. Override with AI_PROVIDER=gemini|anthropic|openai.
// Research: web search before writing. Gemini+Google Search when
// AI_PROVIDER=gemini; OpenRouter's web plugin when AI_PROVIDER=openrouter
// (OPENROUTER_RESEARCH_MODEL, default OPENROUTER_MODEL; OPENROUTER_SEARCH_ENGINE,
// default exa; OPENROUTER_SEARCH_RESULTS, default 8); otherwise Claude web
// search when ANTHROPIC_API_KEY is set, else OpenRouter when
// OPENROUTER_API_KEY is set.
// Images: fal.ai FLUX (FAL_KEY). Pass --no-images to skip.

if (!process.env.AI_PROVIDER) process.env.AI_PROVIDER = 'openrouter';

import fs from 'node:fs';
import fsP from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { getPayload } from 'payload';
import config from '../../payload.config';
import { fal } from '@fal-ai/client';
import * as rules from './content-rules.mjs';
import { parseAiJson } from './parse-ai-json.mjs';

const require = createRequire(import.meta.url);
const yargs = (await import('yargs')).default;
const { hideBin } = await import('yargs/helpers');
const slugify = (await import('slugify')).default;
const { input, select } = await import('@inquirer/prompts');

// ---------------------------------------------------------------------------
// Site constants
// ---------------------------------------------------------------------------

const SITE_URL = 'https://nxtsmarthome.com.au';
const SITE_NAME = 'NXT Smart Home';
const MEDIA_UPLOADS_DIR = '/kspellman/sites/nxtsmarthome.com.au/media/uploads';

const CATEGORIES = {
  security:           'Security & Cameras',
  lighting:           'Lighting',
  energy:             'Energy & Solar',
  entertainment:      'Entertainment & Audio',
  climate:            'Climate & Comfort',
  'hubs-and-platforms': 'Hubs & Platforms',
  'robot-vacuums':    'Robot Vacuums',
  'setup-guides':     'Setup Guides',
  'buying-guides':    'Buying Guides',
};

// Maps legacy category names (from topics.txt / old Strapi site) to Payload category keys.
const CATEGORY_NAME_MAP: Record<string, string> = {
  'smart home security':       'security',
  'smart home energy':         'energy',
  'smart home entertainment':  'entertainment',
  'smart home automation':     'hubs-and-platforms',
  'smart home integration':    'hubs-and-platforms',
  'smart home devices':        'hubs-and-platforms',
  'informative articles':      'hubs-and-platforms',
  'how-to guides':             'setup-guides',
  'product comparisons':       'buying-guides',
  'product reviews':           'buying-guides',
  'top-rated products':        'buying-guides',
};

const POST_TYPE_CHOICES = [
  ['informative',        'Explainer / informative'],
  ['how-to-guide',       'How-to guide'],
  ['buying-guide',       'Buying guide'],
  ['product-comparison', 'Comparison'],
  ['product-roundup',    'Roundup'],
  ['pillar',             'Pillar / complete guide'],
];

const ARTICLE_LENGTH_TARGETS = {
  short:  { label: 'Short',  words: '700-900',   min: 700 },
  medium: { label: 'Medium', words: '1000-1300', min: 1000 },
  long:   { label: 'Long',   words: '1500-2200', min: 1400 },
};

/*
 * The byline is the person who edits and fact-checks the draft, passed with
 * --author <slug>; by default the site editor. It used to be picked at random
 * from three authors, which put names on articles those people never touched
 * (SEO audit CQ1, Oct 2026). Never randomise it.
 *
 * Payload's author records were imported from Strapi, where Kritin Curtis has
 * the slug `k-curtis`; the site shows that profile at /authors/kritin-curtis/
 * (AUTHOR_ALIASES in lib/authors.ts). The lookup accepts either slug.
 */
const DEFAULT_AUTHOR_SLUG = 'kritin-curtis';
const AUTHOR_SLUG_ALIASES: Record<string, string[]> = {
  'kritin-curtis': ['k-curtis'],
  'k-curtis': ['kritin-curtis'],
};

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const argv = yargs(hideBin(process.argv))
  .usage('Usage: $0 [topic] [options]')
  .option('topic',        { alias: 't', type: 'string', describe: 'Article topic / title' })
  .option('topics',       { type: 'string', describe: 'Topic file path. Use topics.txt for the bundled list. Format: "Category | Topic" (one per line, # comments ok)' })
  .option('category',     { alias: 'c', type: 'string', choices: Object.keys(CATEGORIES), describe: 'Category key' })
  .option('count',        { alias: 'n', type: 'number', describe: 'Number of topics to brainstorm (with --category)' })
  .option('post-type',    { type: 'string', describe: 'Override post type' })
  .option('length',       { alias: 'l', type: 'string', choices: Object.keys(ARTICLE_LENGTH_TARGETS), describe: 'Article length' })
  .option('tone',         { type: 'string', default: 'helpful', choices: ['helpful', 'professional', 'friendly'] })
  .option('keywords',     { alias: 'k', type: 'string', describe: 'Comma-separated SEO keywords' })
  .option('publish',      { type: 'boolean', default: false, describe: 'Publish immediately (default: draft)' })
  .option('publishedAt',  { alias: 'published-at', type: 'string', describe: 'Scheduled release (Perth time, e.g. 2026-11-01T09:00). Implies --publish.' })
  .option('publish-every', { type: 'number', describe: 'Hours between releases in a batch' })
  .option('images',       { type: 'boolean', describe: 'Generate cover + 2 gallery images with fal.ai' })
  .option('image-model',  { type: 'string', default: 'schnell', choices: ['schnell', 'dev', 'pro'], describe: 'FLUX variant' })
  .option('research',     { type: 'boolean', default: true, describe: 'Research topic with web search before writing' })
  .option('limit',        { type: 'number', describe: 'Max articles to generate (useful with --topics to run a subset)' })
  .option('allow-duplicate', { type: 'boolean', default: false, describe: 'Write even when a near-duplicate article already exists' })
  .option('dry-run',      { type: 'boolean', default: false, describe: 'Generate and print JSON; do not save to the database' })
  .option('author',       { alias: 'a', type: 'string', default: DEFAULT_AUTHOR_SLUG, describe: 'Byline: slug of the author who edits and fact-checks these drafts' })
  .help()
  .parseSync();

// Positional topic
if (!argv.topic && argv._[0]) argv.topic = String(argv._[0]);

const {
  AI_PROVIDER = 'openai',
  GEMINI_API_KEY,
  GEMINI_MODEL = 'gemini-3.8-flash',
  GEMINI_MAX_OUTPUT_TOKENS = '32000',
  ANTHROPIC_API_KEY,
  CLAUDE_MODEL = 'claude-sonnet-4-6',
  CLAUDE_MAX_TOKENS = '16000',
  OPENAI_API_KEY,
  OPENAI_MODEL = 'gpt-4.1',
  OPENAI_MAX_OUTPUT_TOKENS = '16000',
  OPENROUTER_API_KEY,
  OPENROUTER_MODEL = 'openai/gpt-4.1',
  OPENROUTER_MAX_TOKENS = '16000',
  OPENROUTER_RESEARCH_MODEL,
  OPENROUTER_SEARCH_ENGINE = 'exa',
  OPENROUTER_SEARCH_RESULTS = '8',
  FAL_KEY,
} = process.env;

const aiProvider = AI_PROVIDER.toLowerCase();
if (!['gemini', 'anthropic', 'openai', 'openrouter'].includes(aiProvider)) fatal(`Unknown AI_PROVIDER: ${AI_PROVIDER}`);
if (aiProvider === 'gemini' && !GEMINI_API_KEY)   fatal('GEMINI_API_KEY is not set.');
if (aiProvider === 'anthropic' && !ANTHROPIC_API_KEY) fatal('ANTHROPIC_API_KEY is not set.');
if (aiProvider === 'openai' && !OPENAI_API_KEY)   fatal('OPENAI_API_KEY is not set.');
if (aiProvider === 'openrouter' && !OPENROUTER_API_KEY) fatal('OPENROUTER_API_KEY is not set.');
if (argv.images !== false && !argv['dry-run'] && !FAL_KEY) {
  if (argv.images === true) fatal('FAL_KEY is not set. Get one at https://fal.ai/dashboard/keys or pass --no-images.');
}
if (FAL_KEY) fal.config({ credentials: FAL_KEY });

const FAL_MODELS: Record<string, string> = {
  schnell: 'fal-ai/flux/schnell',
  dev:     'fal-ai/flux/dev',
  pro:     'fal-ai/flux-pro',
};

// ---------------------------------------------------------------------------
// Payload initialisation (lazy, avoids cost on --dry-run)
// ---------------------------------------------------------------------------

let _payload: Awaited<ReturnType<typeof getPayload>> | null = null;
async function db() {
  if (!_payload) _payload = await getPayload({ config });
  return _payload;
}

// ---------------------------------------------------------------------------
// Scheduled release
// ---------------------------------------------------------------------------

let releaseBase: Date | null = null;
let releaseIndex = 0;

function resolveRelease() {
  if (!argv.publishedAt) {
    if (argv['publish-every']) fatal('--publish-every needs --publishedAt');
    return;
  }
  if (argv['publish-every'] !== undefined && !(argv['publish-every'] > 0)) fatal('--publish-every must be a positive number of hours');
  releaseBase = parseReleaseDate(argv.publishedAt);
  argv.publish = true;
  const when = releaseBase.toLocaleString('en-AU', { timeZone: 'Australia/Perth', dateStyle: 'medium', timeStyle: 'short' });
  console.log(`Release: ${releaseBase.toISOString()} (${when} Perth)${argv['publish-every'] ? `, then every ${argv['publish-every']}h` : ''}${releaseBase < new Date() ? ' — in the past, so visible immediately' : ''}`);
}

function parseReleaseDate(raw: string): Date {
  const value = String(raw).trim();
  const hasZone = /(Z|[+-]\d{2}:?\d{2})$/i.test(value);
  const normalised = value.includes('T') || !/\d{2}:\d{2}/.test(value) ? value : value.replace(' ', 'T');
  const withTime = /T\d{2}:\d{2}/.test(normalised) ? normalised : `${normalised}T00:00`;
  const date = new Date(hasZone ? withTime : `${withTime}+08:00`);
  if (Number.isNaN(date.getTime())) fatal(`--publishedAt: cannot parse "${raw}" (use e.g. 2026-11-01T09:00)`);
  return date;
}

function nextReleaseAt(): string | null {
  if (!releaseBase) return null;
  const hours = argv['publish-every'] || 0;
  const at = new Date(releaseBase.getTime() + releaseIndex * hours * 3_600_000);
  releaseIndex += 1;
  return at.toISOString();
}

// ---------------------------------------------------------------------------
// Product catalogue (Payload)
// ---------------------------------------------------------------------------

let catalogCache: any[] | null = null;

async function loadCatalogue() {
  if (catalogCache) return catalogCache;
  const payload = await db();
  const result = await payload.find({
    collection: 'products',
    where: { and: [{ active: { equals: true } }, { catalogueListing: { equals: true } }] },
    limit: 1000,
    depth: 0,
    overrideAccess: true,
  });
  const withVerdict = result.docs.filter((p: any) =>
    p.slug && p.name && (
      (typeof p.bestFor === 'string' && p.bestFor.trim()) ||
      (Array.isArray(p.pros) && p.pros.length)
    )
  );
  // CQ5: products named or specified for another market (an EU switch, a US
  // plug) are never offered to the writer, so no product marker can place them.
  catalogCache = withVerdict.filter((p: any) => !rules.isNonAuVariant(p));
  const nonAu = withVerdict.length - catalogCache.length;
  console.log(`  catalogue: ${catalogCache.length} products (Payload)${nonAu ? `, ${nonAu} non-AU variant(s) excluded` : ''}`);
  return catalogCache;
}

const PRODUCT_STOP = new Set('a an and are as at australia australian aussie be best buy by can do does for from guide how in into is it its of on or smart home homes that the their this to vs what when where which why will with without you your skin'.split(' '));
const productTokens = (text: string) =>
  String(text || '').toLowerCase().replace(/[^a-z0-9+ ]+/g, ' ').split(/\s+/)
    .filter(w => w.length > 2 && !PRODUCT_STOP.has(w))
    .map(w => w.replace(/s$/, ''));

function pickProducts(topic: string, category: string, candidates = 8) {
  const catalog = catalogCache ?? [];
  if (!catalog.length) return [];
  const want = new Set(productTokens(topic));
  const inCat = (p: any) => p.categoryKey === category || (p.subCategory && slugifyStr(p.subCategory) === category);
  const hasCat = catalog.some(inCat);
  return catalog.map(p => {
    const words = new Set(productTokens(`${p.name} ${p.brand || ''} ${p.subCategory || ''} ${p.bestFor || ''}`));
    let overlap = 0;
    for (const w of want) if (words.has(w)) overlap++;
    const inCategory = inCat(p);
    const reviews = Number(p.reviewCountReal || p.reviewCount || 0);
    const score = overlap * 3 + (inCategory ? 4 : 0) + Math.log10(reviews + 1);
    return { p, score, overlap, inCategory };
  })
    .filter(x => hasCat ? x.inCategory || x.overlap >= 2 : x.overlap >= 1)
    .sort((a, b) => b.score - a.score)
    // Rule 8: products that share words with the topic first. An in-category
    // product with no topic overlap (a hub offered to a kitchen article) is
    // only a filler candidate, offered when too few relevant ones exist.
    .filter((x, _i, all) => x.overlap > 0 || all.filter(y => y.overlap > 0).length < 4)
    .slice(0, candidates)
    .map(x => x.p);
}

function productContext(products: any[]) {
  if (!products.length) return '';
  const lines = products.map((p: any) =>
    `- ${p.slug} | ${p.brand ? `${p.brand} ` : ''}${p.name} | ${p.subCategory || p.categoryName || ''} | best for: ${String(p.bestFor || '').replace(/\s+/g, ' ').slice(0, 160)}`
  );
  return `\n\nCatalogue products (real products sold in Australia, from this site's catalogue):\n${lines.join('\n')}\n\nProduct placement:\n- Feature 2-4 of the products above, but only ones this article genuinely discusses. Never add a sentence or section just to mention one.\n- Name each featured product in the prose by brand and model (e.g. "Aqara Hub M100", "Tapo P110") in the section that discusses it. A marker for a product the text does not name is removed, and an article left with fewer than 2 boxes is held as a draft.\n- Immediately after the section that discusses a product, put its marker alone on its own line: ::product:<slug>::\n- Use only slugs from the list above, each at most once. Never invent products, slugs, prices, specs or ratings. If fewer than 2 genuinely fit, place only those that do.`;
}

function applyProducts(post: any, products: any[]) {
  if (typeof post.content !== 'string') return { placed: 0, dropped: [] as string[] };
  const allowed = new Map(products.map((p: any) => [p.slug, p]));
  const seen = new Set<string>();
  const marker = (key: string) => `\n\n::product:${key}::\n\n`;
  let content = post.content.replace(/::product:([a-z0-9-]+)::/gi, (_: string, slug: string) => {
    const key = slug.toLowerCase();
    if (!allowed.has(key) || seen.has(key)) return '';
    seen.add(key);
    return marker(key);
  });
  // Rule 8: a box only for a product the text names (brand + model, or its name).
  const filtered = rules.filterProductMarkers(content, products);
  content = filtered.text;
  const kept = filtered.kept.slice(0, 4);
  for (const slug of filtered.kept.slice(4)) content = content.replace(new RegExp(`\\s*::product:${slug}::\\s*`, 'i'), '\n\n');
  const placed = new Set<string>(kept);
  // Insert a box for any shortlisted product named in the text but not yet boxed.
  for (const p of products) {
    if (placed.size >= 4) break;
    if (placed.has(p.slug)) continue;
    const idx = rules.productMentionIndex(p, content);
    // Not into the FAQ or Sources (the FAQ is moved to its own field).
    const tail = content.search(/^##\s+(?:Frequently Asked Questions|FAQs?|Sources)\b/im);
    if (idx < 0 || (tail >= 0 && idx >= tail)) continue;
    const nextH = content.slice(idx).search(/\n#{2,6} /);
    const at = nextH >= 0 ? idx + nextH : content.length;
    content = `${content.slice(0, at).replace(/\s+$/, '')}${marker(p.slug)}${content.slice(at).replace(/^\s+/, '')}`;
    placed.add(p.slug);
  }
  post.content = content.replace(/\n{3,}/g, '\n\n').trim();
  post.productSlugs = [...placed];
  return { placed: placed.size, dropped: filtered.dropped };
}

function extractFaq(post: any) {
  if (typeof post.content !== 'string') return 0;
  const m = post.content.match(/^#{2,3}\s+(?:Frequently Asked Questions|FAQs?)\b.*$/im);
  if (!m) return 0;
  const start = m.index!;
  const after = post.content.slice(start + m[0].length);
  const next = after.search(/^##\s|^<h2[\s>]/im);
  const section = next >= 0 ? after.slice(0, next) : after;
  const faq: any[] = [];
  let current: any = null;
  for (const line of section.split('\n')) {
    const q = line.match(/^###\s+(.+?)\s*$/) || line.match(/^\s*\*\*(.+?)\*\*\s*$/);
    if (q) { current = { question: q[1].replace(/\*\*/g, '').trim().slice(0, 300), answer: '' }; faq.push(current); }
    else if (current) current.answer += ` ${line.trim()}`;
  }
  const items = faq
    .map(f => ({ question: f.question, answer: f.answer.replace(/\s+/g, ' ').trim() }))
    .filter(f => f.question && f.answer)
    .map((f, order) => ({ ...f, order }));
  if (!items.length) return 0;
  post.faq = items;
  post.content = `${post.content.slice(0, start).trimEnd()}\n\n${next >= 0 ? after.slice(next) : ''}`.trim();
  return items.length;
}

// ---------------------------------------------------------------------------
// Existing post index (near-duplicate check and internal-link candidates)
// ---------------------------------------------------------------------------

let siteArticlesCache: any[] | null = null;

async function loadSiteArticles() {
  if (siteArticlesCache) return siteArticlesCache;
  if (argv['dry-run']) return (siteArticlesCache = []);
  const payload = await db();
  const result = await payload.find({
    collection: 'posts',
    limit: 1000,
    depth: 0,
    overrideAccess: true,
  });
  siteArticlesCache = result.docs.map((p: any) => ({
    title: String(p.title || '').trim(),
    slug: p.slug || '',
    categoryId: p.categories?.[0] || null,
    published: p._status === 'published',
  }));
  return siteArticlesCache;
}

async function loadExistingPostKeys() {
  const articles = await loadSiteArticles();
  const slugs = new Set(articles.map((a: any) => a.slug).filter(Boolean));
  const titles = new Set(articles.map((a: any) => String(a.title).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()));
  return { slugs, titles };
}

async function relevantInternalLinks(topic: string, category: string, limit = 10) {
  const words = (t: string) => new Set(String(t).toLowerCase().match(/[a-z0-9]+/g)?.filter(w => w.length > 3 && !PRODUCT_STOP.has(w)) ?? []);
  const want = words(topic);
  const articles = await loadSiteArticles();
  const payload = await db();
  // Resolve category slug once for scoring
  const catResult = await payload.find({ collection: 'categories', where: { slug: { equals: category } }, limit: 1, depth: 0, overrideAccess: true });
  const catId = catResult.docs[0]?.id;
  return articles
    .filter((a: any) => a.published && a.title)
    .map((a: any) => {
      let score = (catId && a.categoryId === catId) ? 1 : 0;
      for (const w of words(a.title)) if (want.has(w)) score += 2;
      return { ...a, score };
    })
    .filter((a: any) => a.score > 0)
    .sort((a: any, b: any) => b.score - a.score)
    .slice(0, limit)
    .map((a: any) => ({ title: a.title, url: rules.articleUrl(category, a.slug) }));
}

async function buildInternalLinkContext(category: string, topic: string) {
  const candidates = await relevantInternalLinks(topic, category);
  if (!candidates.length) return '';
  const lines = candidates.map((p: any, i: number) => `${i + 1}. ${p.title} - ${p.url}`).join('\n');
  return `\n\nInternal-link opportunities from existing NXT Smart Home articles:\n${lines}\n\nInternal linking requirements:\n- Add 2-4 links only where they help the reader continue the same topic.\n- Use the exact URLs above.\n- Use descriptive anchor text.\n- Do not link to the new article itself.\n`;
}

// ---------------------------------------------------------------------------
// Authors (Payload)
// ---------------------------------------------------------------------------

let authorId: number | null = null;

/** The one author every article in this run is bylined to (--author). Fails the run if unknown. */
async function resolveAuthorId(): Promise<number> {
  if (authorId) return authorId;
  const wanted = String(argv.author || DEFAULT_AUTHOR_SLUG).trim().toLowerCase();
  const slugs = [wanted, ...(AUTHOR_SLUG_ALIASES[wanted] ?? [])];
  const payload = await db();
  const result = await payload.find({
    collection: 'authors',
    where: { slug: { in: slugs } },
    depth: 0,
    overrideAccess: true,
  });
  const doc: any = result.docs.find((a: any) => a.slug === wanted) ?? result.docs[0];
  if (!doc) fatal(`--author "${wanted}" is not an author in Payload (tried ${slugs.join(', ')}). Pass the slug of the person who edits and fact-checks these drafts.`);
  authorId = Number(doc.id);
  console.log(`Byline: ${doc.name || doc.slug} (${doc.slug})`);
  return authorId;
}

// ---------------------------------------------------------------------------
// Category resolution (Payload)
// ---------------------------------------------------------------------------

const categoryIdCache = new Map<string, number>();

async function resolveCategoryId(slug: string): Promise<number | null> {
  if (categoryIdCache.has(slug)) return categoryIdCache.get(slug)!;
  const payload = await db();
  const result = await payload.find({ collection: 'categories', where: { slug: { equals: slug } }, limit: 1, depth: 0, overrideAccess: true });
  const id = result.docs[0] ? Number(result.docs[0].id) : null;
  if (!id) console.warn(`  category "${slug}" not found in Payload — post will have no category`);
  else categoryIdCache.set(slug, id);
  return id;
}

// ---------------------------------------------------------------------------
// Image generation (fal.ai) and saving to Payload media
// ---------------------------------------------------------------------------

async function generateImage(prompt: string, aspect = 'landscape_16_9'): Promise<string> {
  const modelId = FAL_MODELS[argv['image-model']] ?? FAL_MODELS.schnell;
  const result: any = await fal.subscribe(modelId, { input: { prompt, image_size: aspect, num_images: 1, enable_safety_checker: true }, logs: false });
  const url = result?.data?.images?.[0]?.url;
  if (!url) throw new Error(`fal.ai returned no image URL for: ${prompt.slice(0, 80)}`);
  return url;
}

async function saveImageToPayload(imageUrl: string, filename: string, alt: string): Promise<number | null> {
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`Failed to download image ${imageUrl}: ${res.status}`);
  const ab = await res.arrayBuffer();
  const ct = res.headers.get('content-type') || 'image/jpeg';
  const ext = ct.includes('png') ? 'png' : ct.includes('webp') ? 'webp' : 'jpg';
  const name = `${filename}.${ext}`.slice(0, 120);
  const tmpFile = path.join(os.tmpdir(), name);
  await fsP.writeFile(tmpFile, Buffer.from(ab));
  try {
    const payload = await db();
    const doc: any = await payload.create({
      collection: 'media',
      data: { alt },
      filePath: tmpFile,
      overwriteExistingFiles: false,
    });
    return Number(doc.id);
  } finally {
    await fsP.unlink(tmpFile).catch(() => {});
  }
}

async function generateAndSaveImages(post: any): Promise<{ coverId: number | null; galleryIds: number[] }> {
  const prompts = fillMissingImagePrompts(post?.imagePrompts, post);
  const baseName = slugifyStr(post.title || 'post').slice(0, 50);
  process.stdout.write(`  generating 3 images with fal.ai FLUX [${argv['image-model']}]... `);
  const t0 = Date.now();
  const allPrompts = [
    { kind: 'cover',     prompt: prompts.cover,      aspect: 'landscape_16_9' },
    { kind: 'gallery-1', prompt: prompts.gallery[0],  aspect: 'landscape_4_3' },
    { kind: 'gallery-2', prompt: prompts.gallery[1],  aspect: 'landscape_4_3' },
  ];
  const alts = imageAlts(post, prompts);
  const results = await Promise.all(allPrompts.map(async ({ kind, prompt, aspect }) => {
    const url = await generateImage(prompt, aspect);
    const id = await saveImageToPayload(url, `${baseName}-${kind}`, alts[kind as keyof typeof alts]);
    return { kind, id };
  }));
  process.stdout.write(`${((Date.now() - t0) / 1000).toFixed(1)}s\n`);
  const coverId = results.find(r => r.kind === 'cover')?.id ?? null;
  const galleryIds = results.filter(r => r.kind !== 'cover').map(r => r.id).filter((id): id is number => id !== null);
  return { coverId, galleryIds };
}

/** Descriptive alt text: cover = article title; gallery = the section each image illustrates. */
function imageAlts(post: any, prompts: { cover: string; gallery: string[] }) {
  const sections = extractH2Sections(String(post?.content || ''));
  const base = { title: post?.title, seoTitle: post?.seoTitle, sections, body: String(post?.content || '') };
  const cover = rules.imageAltText({ ...base, kind: 'cover', prompt: prompts.cover });
  const g1 = rules.imageAltText({ ...base, kind: 'gallery', prompt: prompts.gallery[0] });
  const used = sections.filter((s) => g1.toLowerCase().startsWith(s.toLowerCase().slice(0, 20)));
  let g2 = rules.imageAltText({ ...base, kind: 'gallery', prompt: prompts.gallery[1], exclude: used });
  if (g2 === g1) g2 = rules.imageAltText({ ...base, kind: 'gallery', prompt: prompts.gallery[1], sections: [] });
  return { cover, 'gallery-1': g1, 'gallery-2': g2 };
}

function extractH2Sections(markdown: string): string[] {
  return (markdown.match(/^##\s+(.+)/gm) ?? [])
    .map(h => h.replace(/^##\s+/, '').replace(/\*\*/g, '').trim())
    .filter(h => !/^(sources|references|faq|frequently asked)/i.test(h));
}

const NO_TEXT = 'No text, letters, words, numbers, titles, labels, watermarks, signs, screens or logos anywhere in the image.';

function fillMissingImagePrompts(prompts: any, post: any) {
  const title = post?.title || 'smart home';
  const sections = extractH2Sections(String(post?.content || ''));
  const usedFallback = !prompts?.cover || (Array.isArray(prompts?.gallery) && prompts.gallery.length < 2);

  const cover = prompts?.cover
    || `Editorial hero photograph for an article about "${title}". A modern Australian home with smart devices visible in the environment — clean, uncluttered setting, soft natural daylight through windows, shallow depth of field, photorealistic. Shot on a 50mm lens. ${NO_TEXT}`;

  const gallery = Array.isArray(prompts?.gallery) ? [...prompts.gallery] : [];

  // Build section-specific fallbacks from the article's H2 headings
  const sectionFallbacks = sections.slice(0, 4).map((section, i) => {
    const angle = i % 2 === 0
      ? `close-up, soft side lighting, neutral tones, editorial photography`
      : `wide shot, natural daylight from a window, modern Australian home interior, photorealistic`;
    return `Editorial photograph illustrating the concept of "${section}" in a smart home context. Australian home setting, ${angle}. ${NO_TEXT}`;
  });

  const genericFallback = [
    `A smart home hub and sensors arranged on a shelf in a modern Australian home. Clean white surfaces, soft warm indoor lighting, shallow depth of field, editorial photography style. ${NO_TEXT}`,
    `Australian living room with smart lighting and automation devices. Warm evening light, minimalist décor, wide angle shot. ${NO_TEXT}`,
  ];

  const fallbacks = sectionFallbacks.length >= 2 ? sectionFallbacks : genericFallback;
  while (gallery.length < 2) gallery.push(fallbacks[gallery.length] ?? fallbacks[0]);

  if (usedFallback) console.log('  (model returned incomplete image prompts — using section-derived fallbacks)');
  // The model's own prompts must also forbid text in the image.
  const noText = (p: string) => (/\bno text\b/i.test(p) ? p : `${String(p).trim()} ${NO_TEXT}`);
  return { cover: noText(cover), gallery: gallery.slice(0, 2).map(noText) };
}

// ---------------------------------------------------------------------------
// AI generation
// ---------------------------------------------------------------------------

async function callAI({ system, user, maxTokens }: { system: string; user: string; maxTokens: number }): Promise<string> {
  if (aiProvider === 'gemini') {
    const json = await rules.geminiGenerate({
      apiKey: GEMINI_API_KEY!,
      model: GEMINI_MODEL,
      body: {
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: { responseMimeType: 'application/json', maxOutputTokens: maxTokens },
      },
    });
    return rules.geminiText(json).trim();
  }
  if (aiProvider === 'anthropic') {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY!, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: CLAUDE_MODEL, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] }),
    });
    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const msg: any = await res.json();
    return msg.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('').trim();
  }
  if (aiProvider === 'openrouter') {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'authorization': `Bearer ${OPENROUTER_API_KEY}` },
      body: JSON.stringify({ model: OPENROUTER_MODEL, messages: [{ role: 'system', content: system }, { role: 'user', content: user }], max_tokens: maxTokens }),
    });
    if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const msg: any = await res.json();
    return msg.choices?.[0]?.message?.content?.trim() || '';
  }
  // OpenAI
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'authorization': `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({ model: OPENAI_MODEL, messages: [{ role: 'system', content: system }, { role: 'user', content: user }], max_tokens: maxTokens }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const msg: any = await res.json();
  return msg.choices?.[0]?.message?.content?.trim() || '';
}

function activeModel() {
  if (aiProvider === 'gemini')    return GEMINI_MODEL;
  if (aiProvider === 'anthropic') return CLAUDE_MODEL;
  if (aiProvider === 'openrouter') return OPENROUTER_MODEL;
  return OPENAI_MODEL;
}

function maxTokens() {
  if (aiProvider === 'gemini')    return Number(GEMINI_MAX_OUTPUT_TOKENS) || 32000;
  if (aiProvider === 'anthropic') return Number(CLAUDE_MAX_TOKENS) || 16000;
  if (aiProvider === 'openrouter') return Number(OPENROUTER_MAX_TOKENS) || 16000;
  return Number(OPENAI_MAX_OUTPUT_TOKENS) || 16000;
}

// ---------------------------------------------------------------------------
// Article generation
// ---------------------------------------------------------------------------

async function brainstormTopics(category: string, count: number): Promise<string[]> {
  const label = CATEGORIES[category as keyof typeof CATEGORIES] || category;
  const result = await callAI({
    system: 'You are an editorial strategist for an Australian smart-home site. Return only valid JSON.',
    user: `Brainstorm ${count} strong article titles for NXT Smart Home (nxtsmarthome.com.au), an Australian smart-home guide.

Category: ${label}
Australian audience: homeowners and renters across all states. 240V, AU retailers, AU standards.
Site niche: smart home devices, security cameras, lighting, energy, climate, hubs and platforms, robot vacuums, setup and buying guides.

Return STRICT JSON only:
{ "topics": ["title one", "title two"] }

Rules:
- Each topic must be specific, practically useful and suitable for the AU market.
- Avoid years. Avoid duplicate wording. Use Australian English.
- No fake prices, specs, ratings or unsupported claims.`,
    maxTokens: 1200,
  });
  const parsed = parseAiJson(result, { providerName: aiProvider });
  const topics: string[] = Array.isArray(parsed?.topics) ? parsed.topics : [];
  if (!topics.length) throw new Error('AI did not return any topics');
  return topics.slice(0, count);
}

async function researchTopic(topic: string, category: string) {
  const label = CATEGORIES[category as keyof typeof CATEGORIES] || category;
  if (aiProvider === 'gemini') {
    try {
      const result = await rules.researchWithGemini({
        apiKey: GEMINI_API_KEY!,
        model: GEMINI_MODEL,
        prompt: rules.researchPrompt(topic, label),
      });
      console.log(`  research : Gemini+Google Search, ${result.json.facts.length} facts, ${result.searchedUrls.size} source URLs`);
      if (!result.searchedUrls.size) throw new Error('no search results');
      return result;
    } catch (err: any) {
      console.log(`  research : failed (${err.message.slice(0, 160)}) — article will be held as draft`);
      return null;
    }
  }
  if (aiProvider === 'openrouter') return researchWithOpenRouter(topic, label);
  if (ANTHROPIC_API_KEY) {
    try {
      const { researchJson } = await import('/opt/strapi-cms-git/backend/ai-writer-cli/originfacts-content-rules.js');
      const result = await researchJson({
        apiKey: ANTHROPIC_API_KEY,
        model: CLAUDE_MODEL,
        system: 'You research facts for an Australian smart-home site. Use web search. Report only what pages you found actually state, each with its URL.',
        prompt: rules.researchPrompt(topic, label),
        schema: rules.RESEARCH_SCHEMA,
        maxSearches: 6,
      });
      for (const f of [...(result.json.facts || []), ...(result.json.officialSources || [])]) {
        if (f.url) result.searchedUrls.add(rules.normaliseUrl(f.url));
      }
      console.log(`  research : Claude+web search, ${result.json.facts?.length || 0} facts, ${result.searchedUrls.size} URLs`);
      return result;
    } catch (err: any) {
      console.log(`  research : failed (${err.message.slice(0, 160)}) — article will be held as draft`);
      return null;
    }
  }
  if (OPENROUTER_API_KEY) return researchWithOpenRouter(topic, label);
  console.log('  research : skipped (no ANTHROPIC_API_KEY or OPENROUTER_API_KEY, and AI_PROVIDER is not gemini) — article will be held as draft');
  return null;
}

/*
 * OpenRouter web search (web plugin, Exa engine by default). Pricing, from
 * openrouter.ai/docs/features/web-search (Oct 2026): Exa $0.007 per search
 * request including up to 10 results ($0.001 per extra result); Parallel
 * $0.001-$0.005 per request; Perplexity $0.005; native engines pass through
 * the provider's price. Plus the research model's token cost. One search per
 * article. See rules.researchWithOpenRouter.
 */
async function researchWithOpenRouter(topic: string, label: string) {
  const model = OPENROUTER_RESEARCH_MODEL || OPENROUTER_MODEL;
  try {
    const result: any = await rules.researchWithOpenRouter({
      apiKey: OPENROUTER_API_KEY!,
      model,
      prompt: rules.researchPrompt(topic, label),
      engine: OPENROUTER_SEARCH_ENGINE,
      maxResults: Math.min(Math.max(Number(OPENROUTER_SEARCH_RESULTS) || 8, 1), 20),
    });
    const usage = rules.openRouterUsageLine(result.usage);
    console.log(`  research : OpenRouter web search (${model}, ${OPENROUTER_SEARCH_ENGINE}), ${result.json.facts.length} facts, ${result.citedUrls.length} cited URLs, ${result.searchedUrls.size} source URLs${usage ? ` · ${usage}` : ''}`);
    if (!result.searchedUrls.size) throw new Error('no search results');
    return result;
  } catch (err: any) {
    console.log(`  research : failed (${String(err.message).slice(0, 160)}) — article will be held as draft`);
    return null;
  }
}

async function generatePost(topic: string, category: string) {
  const label = CATEGORIES[category as keyof typeof CATEGORIES] || category;
  const lengthCfg = ARTICLE_LENGTH_TARGETS[argv.length as keyof typeof ARTICLE_LENGTH_TARGETS] ?? ARTICLE_LENGTH_TARGETS.long;
  const products = await loadCatalogue().then(c => c ? pickProducts(topic, category) : []);
  const internalLinkCtx = await buildInternalLinkContext(category, topic);
  const research = argv.research ? await researchTopic(topic, category) : null;
  const researchCtx = research ? rules.researchNotes(research.json) : '';
  const productsCtx = productContext(products);

  const prompt = `${rules.NXTSMARTHOME_RULES}

Write one complete blog article.

Topic: ${topic}
Category: ${label}
Tone: ${argv.tone}
Length: at least ${lengthCfg.min} words (target ${lengthCfg.words})
Language: Australian English
SEO keywords: ${argv.keywords || 'choose natural keywords from the topic'}
${productsCtx}${researchCtx}${internalLinkCtx}

Return STRICT JSON only with exactly these keys:
{
  "title": string,
  "slug": string,
  "excerpt": string,
  "content": string,
  "seoTitle": string,
  "seoDescription": string,
  "seoKeywords": string,
  "readingTimeMinutes": number,
  "imagePrompts": {
    "cover": string,
    "gallery": [string, string]
  }
}

Content requirements:
- Markdown only in "content". Use H2/H3 headings.
- Open with a 40-60 word direct answer to the question in the title, as a plain paragraph before the first heading.
- Question-form H2s: at least 3 of the H2s (or 40% of them if that is fewer; Sources and FAQ do not count) must be questions a reader would ask, ending in "?". Keep the rest as plain labels; no more than about half questions.
- Keep sentences under 30 words, averaging under 20. Short paragraphs.
- Comparison, buying-guide and roundup articles, and any article whose title says best, vs, versus, compare, comparison, buying guide or "top N", must include a Markdown comparison table (header row plus |---| separator row) near the top.
- Name the product shortlist early — within the first third of the article for roundups, buying guides and comparisons.
- Close with "## Frequently Asked Questions" (4-6 questions each answered in 40-90 words).
- End with "## Sources": the official and manufacturer pages from the research notes.
- Link 2-4 related NXT Smart Home articles from the internal-link list where they genuinely help.
- seoDescription: 120-155 characters, plain text.
- Keep claims factual. Never invent prices, specs, ratings or test results.

Image prompt requirements:
- Three prompts: one cover (16:9 landscape) and exactly two gallery (4:3 landscape).
- Photorealistic editorial photography style. Australian home context where it fits naturally.
- CRITICAL — absolutely no text, letters, words, numbers, titles, labels, watermarks, overlays, captions, or writing of any kind anywhere in any image. No logos, no brand names, no product packaging with readable text, no signs.
- No close-up faces. No computer/phone screens showing text.
- The cover must represent the article topic as a whole — the hero shot for the whole piece.
- Each gallery image must illustrate a DIFFERENT specific section or concept discussed in the article content. Read the H2 headings and pick two distinct subjects that appear in the article. Each gallery image should be clearly different from the cover and from each other.
- 40-70 words each: specific subject drawn from the article content, precise setting, natural lighting description, camera angle and composition. Make the subject concrete — not "smart home devices" but the specific device or scenario the section covers.
- Avoid generic interior shots. Make each image earn its place by illustrating a real point in the article.`;

  const raw = await callAI({
    system: 'You are a senior SEO editor writing for an Australian smart-home site. Return strict JSON only. Never invent facts that require current verification.',
    user: prompt,
    maxTokens: maxTokens(),
  });

  const post = parseAiJson(raw, { providerName: aiProvider });
  if (!post?.title || !post?.content) throw new Error('AI response missing required fields (title, content)');

  // Normalise
  post.title = limitText(post.title, 255);
  post.slug = slugifyStr(post.slug || post.title);
  post.excerpt = limitText(post.excerpt, 500);
  post.seoTitle = limitText(post.seoTitle, 70);
  post.seoDescription = limitText(post.seoDescription, rules.META_DESCRIPTION_MAX);
  post.seoKeywords = limitText(post.seoKeywords, 255);
  post.postType = argv['post-type'] || 'informative';
  post.readingTimeMinutes = Number(post.readingTimeMinutes) || estimateReadingTime(post.content);

  if (post.editorialNotes) { printEditorialNotes(post.editorialNotes); delete post.editorialNotes; }

  post.content = rules.canonicaliseInternalLinks(post.content);
  const linkFix = rules.repairBodyLinks(post.content);
  post.content = linkFix.text;
  if (linkFix.repaired.length) console.log(`  links    : repaired ${linkFix.repaired.length} malformed link(s) (${linkFix.repaired.slice(0, 3).join('; ')}${linkFix.repaired.length > 3 ? '; ...' : ''})`);

  // Research link verification
  if (research?.searchedUrls) {
    const live = await rules.verifyLiveUrls(post.content, research.searchedUrls);
    if (live.length) console.log(`  links    : ${live.length} cited URL(s) not in research but live — kept`);
    const { text, dropped } = rules.unlinkUnsourced(post.content, research.searchedUrls);
    post.content = text;
    if (dropped.length) console.log(`  links    : unlinked ${dropped.length} URL(s) not sourced (${[...new Set(dropped)].slice(0, 4).join(', ')}${dropped.length > 4 ? ', ...' : ''})`);
  }

  // Products (rule 8): boxes only for products the text names; no padding
  // with generic picks. Fewer than 2 is a rules problem, so the post stays a draft.
  const productIssues: string[] = [];
  const min = rules.PRODUCT_BOXES_MIN;
  if (products.length) {
    const { placed, dropped } = applyProducts(post, products);
    console.log(`  products : ${placed} placed${placed ? ` (${post.productSlugs.join(', ')})` : ''} from ${products.length} candidates`);
    if (dropped.length) console.log(`  products : removed ${dropped.length} box(es) for products the text never names (${dropped.join(', ')})`);
    post.productShortfall = placed < min;
    if (post.productShortfall) {
      console.log(`  WARNING  : fewer than ${min} product boxes — saving as DRAFT`);
      productIssues.push(`${placed} product box(es) for products the article names (want at least ${min}; boxes for products the text never names are removed, rule 8)`);
    }
    const faqCount = extractFaq(post);
    if (faqCount) console.log(`  faq      : ${faqCount} questions moved to FAQ field`);
  } else {
    post.productShortfall = true;
    post.content = String(post.content).replace(/\s*::product:[a-z0-9-]+::\s*/gi, '\n\n').trim();
    productIssues.push(`no catalogue products fit this article (want at least ${min} product boxes, rule 8)`);
  }

  // Content rules check
  const issues = [...rules.checkNxtsmarthomeContent(post, { allowedUrls: research?.searchedUrls ?? null }), ...productIssues];
  if (issues.length) {
    console.log(`  rules    : ${issues.length} problem(s):`);
    for (const issue of issues) console.log(`    - ${issue}`);
  } else {
    console.log('  rules    : all checks passed');
  }
  post.rulesIssues = issues;

  if (!research) post.rulesIssues = [...(post.rulesIssues ?? []), 'not researched: facts unverified'];

  // Last gate before saving (audit H2/C3): anything repairBodyLinks could not
  // fix with certainty fails the article outright, draft or not.
  const linkProblems = rules.bodyLinkProblems([post.content, post.excerpt, ...(post.faq ?? []).map((f: any) => f.answer)].join('\n'));
  if (linkProblems.length) throw new Error(`malformed links, article not saved:\n    - ${linkProblems.join('\n    - ')}`);

  return { post, products };
}

// ---------------------------------------------------------------------------
// Save to Payload
// ---------------------------------------------------------------------------

async function saveToPayload(post: any, {
  categoryId,
  coverId,
  galleryIds,
}: {
  categoryId: number | null;
  coverId: number | null;
  galleryIds: number[];
}) {
  const authorId = await resolveAuthorId();
  const shouldPublish = argv.publish && !post.productShortfall && !(post.rulesIssues?.length);
  const releaseAt = shouldPublish ? nextReleaseAt() : null;

  const data: Record<string, any> = {
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    content: post.content,
    postType: post.postType,
    readingTimeMinutes: post.readingTimeMinutes,
    seoTitle: post.seoTitle,
    seoDescription: post.seoDescription,
    seoKeywords: post.seoKeywords,
    source: 'ai',
    _status: shouldPublish ? 'published' : 'draft',
  };

  if (coverId)           data.coverImage = coverId;
  if (galleryIds.length) data.gallery = galleryIds;
  if (authorId)          data.author = authorId;
  if (categoryId)        data.categories = [categoryId];
  if (post.faq?.length)  data.faq = post.faq;

  if (shouldPublish) {
    data.publishedAt = new Date().toISOString();
    if (releaseAt) { data.showFrom = releaseAt; data.publishDate = releaseAt; }
  }

  const payload = await db();
  return payload.create({ collection: 'posts', data, overrideAccess: true });
}

// ---------------------------------------------------------------------------
// Interactive prompts
// ---------------------------------------------------------------------------

async function promptForMissing() {
  if (!argv.topics && !argv.category) {
    argv.category = await select({
      message: 'Which category?',
      pageSize: 15,
      choices: Object.entries(CATEGORIES).map(([value, name]) => ({ name: `${name} (${value})`, value })),
    }) as string;
  }

  if (!argv.topics && !argv.topic && !argv.count) {
    const mode = await select({
      message: 'What to generate?',
      choices: [
        { name: 'Brainstorm topics and generate posts', value: 'count' },
        { name: 'Write one specific topic', value: 'topic' },
      ],
    });
    if (mode === 'topic') {
      argv.topic = await input({ message: 'Article topic / title:', validate: v => String(v).trim() ? true : 'Enter a topic.' });
    } else {
      const n = await input({ message: 'How many posts?', default: '1', validate: v => (Number.isInteger(Number(v)) && Number(v) > 0) ? true : 'Enter a positive integer.' });
      argv.count = Number(n);
    }
  }

  if (!argv['post-type'] && !argv.topics && process.stdin.isTTY && process.stdout.isTTY) {
    argv['post-type'] = await select({
      message: 'Article type?',
      choices: POST_TYPE_CHOICES.map(([value, name]) => ({ name: `${name} (${value})`, value })),
      default: 'informative',
    }) as string;
  }

  if (!argv.publish && !argv.publishedAt && !argv['dry-run'] && process.stdin.isTTY && process.stdout.isTTY) {
    const mode = await select({
      message: 'Publishing?',
      choices: [
        { name: 'Save as draft', value: 'draft' },
        { name: 'Publish now', value: 'now' },
        { name: 'Schedule (showFrom date)', value: 'schedule' },
      ],
    });
    if (mode === 'now') argv.publish = true;
    if (mode === 'schedule') {
      argv.publishedAt = await input({ message: 'Release date/time (Perth), e.g. 2026-11-01 09:00:', validate: v => /^\d{4}-\d{2}-\d{2}/.test(String(v).trim()) ? true : 'Use YYYY-MM-DD or YYYY-MM-DD HH:MM' });
      const every = await input({ message: 'Hours between releases (0 = all at once):', default: '24' });
      if (Number(every) > 0) argv['publish-every'] = Number(every);
    }
  }
  resolveRelease();

  if (argv.images === undefined) {
    if (process.stdin.isTTY && process.stdout.isTTY) {
      argv.images = await select({ message: 'Generate images with fal.ai?', choices: [{ name: 'Yes', value: true }, { name: 'No', value: false }] }) as boolean;
    } else {
      argv.images = true;
    }
  }
  if (argv.images && !argv['dry-run'] && !FAL_KEY) fatal('FAL_KEY is not set. Pass --no-images to skip.');

  if (!argv.length) {
    if (process.stdin.isTTY && process.stdout.isTTY) {
      argv.length = await select({
        message: 'Article length?',
        choices: Object.entries(ARTICLE_LENGTH_TARGETS).map(([value, { label, words }]) => ({ name: `${label} (${words} words)`, value })),
        default: 'long',
      }) as string;
    } else {
      argv.length = 'long';
    }
  }
}

// ---------------------------------------------------------------------------
// Job queue
// ---------------------------------------------------------------------------

async function buildJobs() {
  if (argv.topics) {
    const all = readTopicFile(argv.topics);
    return argv.limit ? all.slice(0, argv.limit) : all;
  }
  if (argv.topic) return [{ category: argv.category!, topic: argv.topic }];
  if (argv.category && argv.count) {
    const topics = await brainstormTopics(argv.category, argv.count);
    return topics.map(topic => ({ category: argv.category!, topic }));
  }
  if (argv.count) {
    const cats = Object.keys(CATEGORIES);
    const perCat = Math.max(1, Math.ceil(argv.count / cats.length));
    const jobs: { category: string; topic: string }[] = [];
    for (const cat of cats) {
      const topics = await brainstormTopics(cat, perCat);
      jobs.push(...topics.map(t => ({ category: cat, topic: t })));
      if (jobs.length >= argv.count) break;
    }
    return jobs.slice(0, argv.count);
  }
  fatal('Provide a topic, --topics file, or --category with --count.');
}

function resolveCategory(raw: string): string {
  const key = raw.toLowerCase().trim();
  // Exact Payload key
  if (key in CATEGORIES) return key;
  // Legacy name from topics.txt
  if (key in CATEGORY_NAME_MAP) return CATEGORY_NAME_MAP[key];
  // Partial slug match (e.g. "security" matches "smart home security")
  for (const [name, mapped] of Object.entries(CATEGORY_NAME_MAP)) {
    if (name.includes(key) || key.includes(name)) return mapped;
  }
  // Warn and fall back
  console.warn(`  WARNING: unknown category "${raw}" — defaulting to hubs-and-platforms`);
  return 'hubs-and-platforms';
}

function readTopicFile(file: string) {
  const resolved = path.isAbsolute(file) ? file : path.resolve(path.dirname(fileURLToPath(import.meta.url)), file);
  const rows = fs.readFileSync(resolved, 'utf8').split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'));
  return rows.map(row => {
    // Format: category | topic [| destinations (Strapi legacy, ignored)]
    const parts = row.split('|').map(p => p.trim()).filter(Boolean);
    const job = parts.length >= 2
      ? { category: resolveCategory(parts[0]), topic: parts[1] }
      : { category: argv.category ? resolveCategory(argv.category) : 'hubs-and-platforms', topic: row };
    return { ...job, rawLine: row, topicsFile: resolved };
  });
}

function markTopicDone(topicsFile: string, rawLine: string) {
  try {
    const content = fs.readFileSync(topicsFile, 'utf8');
    // Replace the exact line (not already commented) with a commented version
    const updated = content.replace(
      new RegExp(`^(${rawLine.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})$`, 'm'),
      `# $1`,
    );
    if (updated !== content) fs.writeFileSync(topicsFile, updated, 'utf8');
  } catch {
    // Non-fatal — topics file update failure shouldn't abort the run
  }
}

// ---------------------------------------------------------------------------
// Main run loop
// ---------------------------------------------------------------------------

async function run() {
  await promptForMissing();

  console.log(`NXT Smart Home article generator`);
  console.log(`AI: ${aiProvider} | model: ${activeModel()} | length: ${argv.length || 'long'} | dry-run: ${argv['dry-run']} | publish: ${argv.publish} | images: ${argv.images}\n`);

  // Resolve the byline before spending anything on generation.
  if (!argv['dry-run']) await resolveAuthorId();

  let jobs = await buildJobs();

  // Near-duplicate check
  if (!argv['allow-duplicate']) {
    const articles = await loadSiteArticles();
    const titles = articles.map((a: any) => a.title);
    jobs = jobs.filter(job => {
      const match = rules.nearDuplicateOf(job.topic, titles);
      if (match) console.log(`Skipped "${job.topic}": too close to existing "${match}" (--allow-duplicate to override)`);
      return !match;
    });
  }

  // Stagger batch releases
  if (argv.publish && jobs.length > 1 && !releaseBase) {
    releaseBase = new Date();
    argv['publish-every'] = argv['publish-every'] ?? 24;
    console.log(`Release: ${jobs.length} articles, ${argv['publish-every']}h apart from now\n`);
  }

  console.log(`Queue: ${jobs.length} post(s)\n`);

  const results: any[] = [];
  for (const [i, job] of jobs.entries()) {
    console.log(`[${i + 1}/${jobs.length}] Generating: ${job.topic}`);

    const categoryId = argv['dry-run'] ? null : await resolveCategoryId(job.category);

    let generationResult: any;
    try {
      generationResult = await generatePost(job.topic, job.category);
    } catch (err: any) {
      console.error(`  ERROR: generation failed — ${err.message}`);
      results.push({ topic: job.topic, status: 'error', error: err.message });
      continue;
    }

    const { post, products } = generationResult;

    if (argv['dry-run']) {
      console.log(JSON.stringify({ category: job.category, data: post }, null, 2));
      results.push({ topic: job.topic, slug: post.slug, status: 'dry-run' });
      continue;
    }

    let coverId: number | null = null;
    let galleryIds: number[] = [];
    if (argv.images) {
      try {
        ({ coverId, galleryIds } = await generateAndSaveImages(post));
      } catch (err: any) {
        const detail = (err as any)?.body?.detail ? `: ${JSON.stringify((err as any).body.detail)}` : '';
        console.log(`  images   : failed (${`${err.message}${detail}`.slice(0, 240)}) — saving without images`);
      }
    }

    const saved: any = await saveToPayload(post, { categoryId, coverId, galleryIds });
    const id = saved?.id;
    const adminUrl = `https://nxtsmarthome.com.au/admin/collections/posts/${id}`;
    const showFrom = saved?.showFrom;
    const published = argv.publish && !post.productShortfall && !post.rulesIssues?.length;
    console.log(`  saved ${published ? 'published' : 'draft'}: ${post.slug}${showFrom ? ` · shows from ${showFrom}` : ''}${coverId ? ` · cover=${coverId}` : ''}${galleryIds.length ? ` · gallery=[${galleryIds.join(',')}]` : ''}`);
    console.log(`  review: ${adminUrl}\n`);
    results.push({ topic: job.topic, slug: post.slug, id, status: !published ? 'draft' : showFrom ? `scheduled ${showFrom}` : 'published' });
    if ((job as any).topicsFile && (job as any).rawLine) markTopicDone((job as any).topicsFile, (job as any).rawLine);
  }

  console.log('Done.');
  for (const r of results) console.log(`- ${r.status}: ${r.slug ?? r.error}`);

  if (_payload) await _payload.destroy();
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function slugifyStr(value: string) {
  return slugify(String(value || ''), { lower: true, strict: true, trim: true });
}

function limitText(value: string, max: number) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  const clip = text.slice(0, max).replace(/[,\s;:.-]+$/, '');
  const last = clip.lastIndexOf(' ');
  return (last >= Math.floor(max * 0.7) ? clip.slice(0, last) : clip).replace(/\s+(and|or|to|for|with|of|in|on|at|by)$/i, '').trim();
}

function estimateReadingTime(markdown: string) {
  const words = String(markdown || '').replace(/<[^>]*>/g, ' ').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 220));
}

function printEditorialNotes(n: any) {
  const list = (v: any) => Array.isArray(v) ? v : v ? [v] : [];
  console.log('\n  -- editorial notes --');
  if (n.searchIntent)     console.log(`  intent   : ${n.searchIntent}`);
  if (n.primaryKeyword)   console.log(`  keyword  : ${n.primaryKeyword}`);
  if (n.secondaryKeywords) console.log(`  related  : ${n.secondaryKeywords}`);
  if (n.audience)         console.log(`  audience : ${n.audience}`);
  if (n.angle)            console.log(`  angle    : ${n.angle}`);
  for (const v of list(n.verifyThese)) console.log(`  VERIFY   : ${v}`);
  for (const c of list(n.checklist))   console.log(`  check    : ${c}`);
  console.log('');
}

function fatal(message: string): never {
  console.error('✖', message);
  process.exit(1);
}

// Exit explicitly: payload.destroy() leaves the database pool open, and the
// process used to sit idle after "Done." until killed.
run().then(() => process.exit(0)).catch(err => fatal(err.message));
