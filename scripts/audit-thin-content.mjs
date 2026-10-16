import { cmsDocuments, closeCMS } from '../lib/cms.ts';
/**
 * Thin-content audit: every article, product and author page with a verdict,
 * built from source data (Strapi + the repo), not the live site, so it can be
 * re-run after every fix.
 *
 *   npm run audit:thin        # writes reports/thin-content-audit.csv, prints a summary
 *
 * Exit code 1 when any INDEXABLE page is DUPLICATE, FIX, OFF-TOPIC or
 * THIN - EMPTY, so it can gate a deploy. Read-only: it never writes to Strapi.
 *
 * Verdicts
 *   article  DUPLICATE   merged away (data/merged-articles.json) but still
 *                        published in Strapi, or in a near-duplicate pair whose
 *                        other half is also still live on the site
 *            FIX         visible [VERIFY] notes or template placeholders. A
 *                        [VERIFY] inside an HTML comment is not visible (so not
 *                        FIX), but the site still holds the post back for it
 *            BORDERLINE  under 800 body words
 *            OK
 *   product  OFF-TOPIC   not a smart home product (woodworking routers etc.)
 *            THIN - EMPTY under 50 original words
 *            THIN        under 300 original words, or missing bestFor/pros/cons
 *            OK          300+ original words with bestFor, pros and cons
 *   author   THIN        no live posts, or a profile under 150 words
 *            OK
 *
 * "Indexable" mirrors what the site does today, so the gate checks what Google
 * can actually see:
 *   article  not held back by lib/editorial-guard.mjs and not merged away in
 *            data/merged-articles.json (same modules lib/content.ts uses)
 *   product  lib/products.ts isIndexableProduct(): a curated content/products/
 *            file with the same slug, bestFor, 3+ pros, 2+ cons and 300+
 *            original words (originalWordCount). Replicated below, because
 *            lib/products.ts is TypeScript; change both together.
 *   author   at least one live post (app/authors/[slug] noindexes the rest)
 */
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { editorialHits, postTexts } from '../lib/editorial-guard.mjs';
import { loadMerges } from '../lib/merged-articles.mjs';
import { offTopicReason } from '../lib/catalogue-guard.mjs';
// The review allow-list lives in one place; Node 22.18+ runs the .ts directly (types only).
import { retailerReviews } from '../lib/review-sources.ts';

const ROOT = process.cwd();
const SITE = 'https://nxtsmarthome.com.au';

const THRESHOLDS = {
  articleBodyWords: 800,
  titleJaccard: 0.5,
  bodyJaccard: 0.3,
  productEmpty: 50,
  productOk: 300,
  productIndexable: 300,
  authorWords: 150,
};

// Category key -> URL slug, as lib/site.ts.
const CATEGORY_SLUG = {
  security: 'security-and-cameras',
  lighting: 'lighting',
  energy: 'energy-and-solar',
  entertainment: 'entertainment-and-audio',
  climate: 'climate-and-comfort',
  'hubs-and-platforms': 'hubs-and-platforms',
  'robot-vacuums': 'robot-vacuums',
  'setup-guides': 'setup-guides',
  'buying-guides': 'buying-guides',
};



// --- text helpers -----------------------------------------------------------

function words(text) {
  return String(text ?? '').split(/\s+/).filter(Boolean).length;
}

/** Markdown (and any inline HTML) down to countable prose. */
function stripMarkdown(md) {
  return String(md ?? '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/::product:[^:]+::/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, '')
    .replace(/[*_`|]/g, ' ');
}

const stripHtml = (html) => String(html ?? '').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ');

function titleTokens(title) {
  return new Set(
    String(title)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .split(' ')
      .filter((w) => w.length > 3),
  );
}

function shingles(body, n = 5) {
  const w = stripMarkdown(body).toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ').filter(Boolean);
  const out = new Set();
  for (let i = 0; i + n <= w.length; i += 1) out.add(w.slice(i, i + n).join(' '));
  return out;
}

function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter += 1;
  return inter / (a.size + b.size - inter);
}

// --- sources ----------------------------------------------------------------

async function strapiAll(collection, extra) { return cmsDocuments(collection === 'nxtsmarthome-posts' ? 'posts' : 'authors'); }

/** Published posts, same query shape as lib/strapi.ts listPosts (showFrom gate included). */
function fetchPosts() {
  const now = Date.now();
  return strapiAll('nxtsmarthome-posts', {
    'sort[0]': 'publishDate:desc',
    'filters[$or][0][showFrom][$null]': 'true',
    'filters[$or][1][showFrom][$lte]': new Date(now - (now % 60_000)).toISOString(),
    'populate[categories]': 'true',
    'populate[author]': 'true',
    'populate[faq]': 'true',
  });
}

/** Merge "from" slugs: data/merged-articles.json (what the site uses) plus Task 7's data/redirects-adsense.json if it exists. */
function mergedFroms() {
  const map = new Map(loadMerges(ROOT).map((m) => [m.fromSlug, m.toSlug]));
  const file = path.join(ROOT, 'data', 'redirects-adsense.json');
  if (fs.existsSync(file)) {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    const list = Array.isArray(raw) ? raw : raw.redirects ?? raw.merges ?? [];
    for (const r of list) {
      const slug = (p) => String(p ?? '').replace(/\/+$/, '').split('/').pop();
      // Product removals live in the same file; only article paths are merges.
      if (r?.from && !String(r.from).startsWith('/products/')) map.set(slug(r.from), slug(r.to));
    }
  }
  return map;
}

/** AUTHOR_ALIASES from lib/authors.ts, read from the source so the two cannot drift. */
function authorAliases() {
  const src = fs.readFileSync(path.join(ROOT, 'lib', 'authors.ts'), 'utf8');
  const block = src.match(/AUTHOR_ALIASES[^=]*=\s*\{([^}]*)\}/);
  const out = {};
  for (const m of (block?.[1] ?? '').matchAll(/'([^']+)'\s*:\s*'([^']+)'/g)) out[m[1]] = m[2];
  return out;
}

function readFrontMatterDir(dir) {
  const full = path.join(ROOT, dir);
  if (!fs.existsSync(full)) return [];
  return fs
    .readdirSync(full)
    .filter((f) => /\.mdx?$/.test(f))
    .map((f) => ({ file: f, slug: f.replace(/\.mdx?$/, ''), ...matter(fs.readFileSync(path.join(full, f), 'utf8')) }));
}

// --- articles ---------------------------------------------------------------

const csvRows = [];
const merged = mergedFroms();
const posts = await fetchPosts();

const articles = posts
  .filter((p) => p.slug && p.title)
  .map((p) => {
    const hits = editorialHits(postTexts(p));
    const verifyTotal = hits.find((h) => h.label === '[VERIFY')?.count ?? 0;
    // Visible = outside HTML comments, i.e. what a reader of the page sees.
    const verify = (postTexts(p).join('\n').replace(/<!--[\s\S]*?-->/g, ' ').match(/\[VERIFY/gi) || []).length;
    const placeholders = hits.filter((h) => h.label !== '[VERIFY');
    const catSlug = p.categories?.[0]?.slug ?? '';
    const faq = (p.faq ?? []).flatMap((f) => [f.q ?? f.question, f.a ?? f.answer]).join(' ');
    return {
      post: p,
      slug: p.slug,
      title: p.title,
      category: catSlug,
      url: `${SITE}/${CATEGORY_SLUG[catSlug] ?? catSlug}/${p.slug}/`,
      bodyWords: words(stripMarkdown(p.content)),
      faqWords: words(faq),
      h2: (String(p.content ?? '').match(/^##\s+\S/gm) || []).length + (String(p.content ?? '').match(/<h2[\s>]/gi) || []).length,
      verify,
      verifyTotal,
      placeholders,
      mergedInto: merged.get(p.slug) ?? null,
      heldBack: hits.length > 0,
      authorSlug: p.author?.slug ?? '',
      _title: titleTokens(p.title),
      _body: shingles(p.content),
    };
  });

for (const a of articles) a.indexable = !a.heldBack && !a.mergedInto;

// Duplicate pairs, clustered with union-find over all published posts.
const pairs = [];
const parent = new Map(articles.map((a) => [a.slug, a.slug]));
const find = (x) => (parent.get(x) === x ? x : (parent.set(x, find(parent.get(x))), parent.get(x)));
for (let i = 0; i < articles.length; i += 1) {
  for (let j = i + 1; j < articles.length; j += 1) {
    const t = jaccard(articles[i]._title, articles[j]._title);
    const b = jaccard(articles[i]._body, articles[j]._body);
    if (t >= THRESHOLDS.titleJaccard || b >= THRESHOLDS.bodyJaccard) {
      pairs.push({ a: articles[i].slug, b: articles[j].slug, title: t, body: b });
      parent.set(find(articles[i].slug), find(articles[j].slug));
    }
  }
}
const clusters = new Map();
for (const a of articles) {
  if (!pairs.some((p) => p.a === a.slug || p.b === a.slug)) continue;
  const root = find(a.slug);
  if (!clusters.has(root)) clusters.set(root, []);
  clusters.get(root).push(a);
}
// A merged-away slug still published in Strapi is a duplicate until it is
// unpublished. A text-similar pair is a live duplicate only while both halves
// are served: a survivor whose twin is already 301'd on the site is not.
for (const a of articles) if (a.mergedInto) a.duplicateOf = a.mergedInto;
for (const group of clusters.values()) {
  const live = group.filter((a) => !a.mergedInto);
  if (live.length < 2) continue;
  for (const a of live) {
    const partner = live.find((o) => o !== a && pairs.some((p) => (p.a === a.slug && p.b === o.slug) || (p.b === a.slug && p.a === o.slug)));
    if (partner) a.duplicateOf = partner.slug;
  }
}

for (const a of articles) {
  let verdict = 'OK';
  let action = '';
  if (a.duplicateOf) {
    verdict = 'DUPLICATE';
    action = a.mergedInto
      ? `Merged: move unique sections into ${a.mergedInto}, then unpublish in Strapi`
      : `Merge with ${a.duplicateOf}: keep one, 301 the other, unpublish it`;
  } else if (a.verify || a.placeholders.length) {  // visible [VERIFY] only
    verdict = 'FIX';
    action = [a.verify ? `Resolve ${a.verify} [VERIFY] note(s)` : '', a.placeholders.length ? 'remove placeholders' : '']
      .filter(Boolean)
      .join('; ') + ' in Strapi';
  } else if (a.bodyWords < THRESHOLDS.articleBodyWords) {
    verdict = 'BORDERLINE';
    action = `Expand to ${THRESHOLDS.articleBodyWords}+ body words`;
  }
  a.verdict = verdict;
  csvRows.push({
    type: 'article',
    url: a.url,
    slug: a.slug,
    title: a.title,
    category: a.category,
    verdict,
    action,
    indexable: a.indexable ? 'yes' : 'no',
    body_words: a.bodyWords,
    faq_words: a.faqWords,
    original_words: '',
    h2_count: a.h2,
    visible_verify: a.verify,
    verify_total: a.verifyTotal,
    placeholders: a.placeholders.map((h) => `${h.label} x${h.count}`).join('; '),
    posts: '',
    duplicate_of: a.duplicateOf ?? a.mergedInto ?? '',
    flags: [
      a.heldBack ? 'held back by editorial guard (404 on site)' : '',
      a.verifyTotal > a.verify ? `${a.verifyTotal - a.verify} [VERIFY] inside HTML comments` : '',
      a.mergedInto ? `merged into ${a.mergedInto}` : '',
      !a.mergedInto && [...merged.values()].includes(a.slug) ? 'merge survivor' : '',
    ]
      .filter(Boolean)
      .join('; '),
  });
}

const stillPublishedFroms = articles.filter((a) => a.mergedInto);

// --- products ---------------------------------------------------------------

// Disabled products (data/disabled-products.json) are off the site, so out of the audit too.
const disabledFile = path.join(ROOT, 'data', 'disabled-products.json');
const disabled = new Set(
  fs.existsSync(disabledFile) ? (JSON.parse(fs.readFileSync(disabledFile, 'utf8')).disabled ?? []).map((d) => d.slug ?? d) : [],
);
const catalogue = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'data', 'products.json'), 'utf8')).filter(
  (p) => !disabled.has(p.slug),
);
const curated = new Map(readFrontMatterDir('content/products').map((c) => [c.slug, c]));

// Not smart home: the same guard the importers use (lib/catalogue-guard.mjs).
const offTopic = (p) => offTopicReason(`${p.brand ?? ''} ${p.name ?? ''} ${p.slug}`, p.categorySlug);


for (const p of catalogue) {
  const c = curated.get(p.slug);
  const note = c ? c.content.replace(/<!--[\s\S]*?-->/g, ' ') : '';
  const bestFor = c?.data.bestFor || p.bestFor || '';
  const pros = c?.data.pros ?? p.pros ?? [];
  const cons = c?.data.cons ?? p.cons ?? [];
  // lib/products.ts originalWordCount(), replicated: the long description only
  // counts when it is our rewrite, never the old generated template.
  const original = words(
    [
      stripMarkdown(note), bestFor, ...pros, ...cons, p.shortDescription ?? '',
      p.descriptionRewrite?.model ? stripHtml(p.cmsDescriptionHtml) : '',
    ].join(' '),
  );

  // lib/products.ts isIndexableProduct(), replicated.
  const indexable = Boolean(
    c && bestFor && pros.length >= 3 && cons.length >= 2 && original >= THRESHOLDS.productIndexable,
  );

  const reviews = p.reviews ?? [];
  const allowedReviews = retailerReviews(p);
  const nonAu = reviews.length - allowedReviews.allowedCount;
  const off = offTopic(p);
  const flags = [
    off ? `off-topic: ${off}` : '',
    bestFor ? '' : 'no bestFor',
    pros.length && cons.length ? '' : 'no pros/cons',
    nonAu ? `${nonAu}/${reviews.length} reviews from sources not allowed` : '',
    allowedReviews.reviews.length ? `reviews block shown (${allowedReviews.reviews.length}${allowedReviews.aggregate ? ', with score' : ''})` : '',
    c ? 'curated' : '',
  ].filter(Boolean);

  let verdict;
  let action;
  if (off) {
    verdict = 'OFF-TOPIC';
    action = 'Delete from the catalogue (not a smart home product)';
  } else if (original < THRESHOLDS.productEmpty) {
    verdict = 'THIN - EMPTY';
    action = 'Keep noindex and out of listings, or write curated editorial';
  } else if (original < THRESHOLDS.productOk || !bestFor || !pros.length || !cons.length) {
    verdict = 'THIN';
    action = `Write curated editorial: ${THRESHOLDS.productOk}+ words with bestFor, pros and cons`;
  } else {
    verdict = 'OK';
    action = '';
  }

  csvRows.push({
    type: 'product',
    url: `${SITE}/products/${p.slug}/`,
    slug: p.slug,
    title: [p.brand, p.name].filter(Boolean).join(' '),
    category: p.categorySlug,
    verdict,
    action,
    indexable: indexable ? 'yes' : 'no',
    body_words: '',
    faq_words: '',
    original_words: original,
    h2_count: '',
    visible_verify: '',
    placeholders: '',
    posts: '',
    duplicate_of: '',
    flags: flags.join('; '),
  });
}

// --- authors ----------------------------------------------------------------

const aliases = authorAliases();
const canonicalAuthor = (slug) => aliases[slug] ?? slug;
const liveArticles = articles.filter((a) => a.indexable);
const siteAuthors = readFrontMatterDir('content/authors').filter((a) => a.data?.name);
let cmsAuthors = [];
try {
  cmsAuthors = await strapiAll('nxtsmarthome-authors', { 'fields[0]': 'name', 'fields[1]': 'slug' });
} catch {
  /* optional: only used for the duplicate-name check */
}

// "K Curtis" and "Kritin Curtis": same surname, first initials agree, different slugs.
const people = [
  ...siteAuthors.map((a) => ({ slug: String(a.data.slug ?? a.slug), name: String(a.data.name), where: 'site' })),
  ...cmsAuthors.map((a) => ({ slug: a.slug, name: a.name, where: 'Strapi' })),
];
function nameClash(name, slug) {
  const [first, ...rest] = name.toLowerCase().split(/\s+/);
  const last = rest.pop();
  return people
    .filter((o) => o.name !== name)
    .filter((o) => {
      const [f, ...r] = o.name.toLowerCase().split(/\s+/);
      return last && r.pop() === last && f[0] === first[0] && o.name !== name;
    })
    .map((o) => `${o.name} (${o.where}: ${o.slug}${aliases[o.slug] ? ` → aliased to ${aliases[o.slug]}` : ''})`);
}

for (const a of siteAuthors) {
  const slug = String(a.data.slug ?? a.slug);
  const count = liveArticles.filter((p) => canonicalAuthor(p.authorSlug) === slug).length;
  const profileWords = words([a.data.bio, stripMarkdown(a.content)].join(' '));
  const clashes = [...new Set(nameClash(String(a.data.name), slug))];
  const thin = count === 0 || profileWords < THRESHOLDS.authorWords;
  csvRows.push({
    type: 'author',
    url: `${SITE}/authors/${slug}/`,
    slug,
    title: String(a.data.name),
    category: '',
    verdict: thin ? 'THIN' : 'OK',
    action: !thin
      ? ''
      : count === 0
        ? 'No live posts: keep noindex, or remove the profile'
        : `Expand the profile to ${THRESHOLDS.authorWords}+ words (bio in Strapi)`,
    indexable: count > 0 ? 'yes' : 'no',
    body_words: '',
    faq_words: '',
    original_words: profileWords,
    h2_count: '',
    visible_verify: '',
    placeholders: /what they cover|e\.g\./i.test(String(a.data.role ?? '')) ? 'role placeholder' : '',
    posts: count,
    duplicate_of: '',
    flags: clashes.length ? `similar name: ${clashes.join(', ')}` : '',
  });
}

// --- output -----------------------------------------------------------------

const COLUMNS = [
  'type', 'url', 'slug', 'title', 'category', 'verdict', 'action', 'indexable', 'body_words', 'faq_words',
  'original_words', 'h2_count', 'visible_verify', 'verify_total', 'placeholders', 'posts', 'duplicate_of', 'flags',
];
const cell = (v) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
fs.mkdirSync(path.join(ROOT, 'reports'), { recursive: true });
const out = path.join(ROOT, 'reports', 'thin-content-audit.csv');
fs.writeFileSync(out, [COLUMNS.join(','), ...csvRows.map((r) => COLUMNS.map((c) => cell(r[c])).join(','))].join('\n') + '\n');

const summary = new Map();
for (const r of csvRows) {
  const key = `${r.type}|${r.verdict}`;
  const s = summary.get(key) ?? { type: r.type, verdict: r.verdict, total: 0, indexable: 0 };
  s.total += 1;
  if (r.indexable === 'yes') s.indexable += 1;
  summary.set(key, s);
}
const order = ['DUPLICATE', 'FIX', 'OFF-TOPIC', 'THIN - EMPTY', 'THIN', 'BORDERLINE', 'OK'];
const rowsOut = [...summary.values()].sort(
  (a, b) => a.type.localeCompare(b.type) || order.indexOf(a.verdict) - order.indexOf(b.verdict),
);

console.log(`wrote ${path.relative(ROOT, out)} (${csvRows.length} rows)\n`);
console.log(`${'type'.padEnd(9)}${'verdict'.padEnd(14)}${'total'.padStart(6)}${'indexable'.padStart(11)}`);
for (const s of rowsOut) {
  console.log(`${s.type.padEnd(9)}${s.verdict.padEnd(14)}${String(s.total).padStart(6)}${String(s.indexable).padStart(11)}`);
}

console.log('\nDuplicate pairs (title >= 0.5 or body >= 0.30):');
if (!pairs.length) console.log('  none');
for (const p of pairs) console.log(`  ${p.a} <> ${p.b}  title=${p.title.toFixed(2)} body=${p.body.toFixed(2)}`);

console.log('\nMerged-away slugs still published in Strapi (unpublish once merged):');
if (!stillPublishedFroms.length) console.log('  none');
for (const a of stillPublishedFroms) console.log(`  ${a.slug} -> ${a.mergedInto}`);

const blocking = new Set(['DUPLICATE', 'FIX', 'OFF-TOPIC', 'THIN - EMPTY']);
const indexableThin = csvRows.filter((r) => r.indexable === 'yes' && r.verdict !== 'OK');
const indexableBlocking = indexableThin.filter((r) => blocking.has(r.verdict));
console.log(`\nINDEXABLE THIN PAGES: ${indexableThin.length}`);
if (indexableBlocking.length) {
  console.log(`BLOCKING (indexable DUPLICATE / FIX / OFF-TOPIC / THIN - EMPTY): ${indexableBlocking.length}`);
  for (const r of indexableBlocking) console.log(`  ${r.verdict.padEnd(13)} ${r.url}`);
  process.exitCode = 1;
}

await closeCMS();
process.exit(0);
