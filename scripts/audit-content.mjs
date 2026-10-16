import { cmsDocuments, closeCMS } from '../lib/cms.ts';
/**
 * Content audit: every published nxtsmarthome post, with the problems that keep
 * a site from being "valuable content" to a reviewer.
 *
 *   npm run audit:content            # table + duplicate clusters
 *   npm run audit:content -- --json  # machine-readable, for ADSENSE_CHANGES.md
 *
 * Per post: slug, title, author, word count, [VERIFY] count, other placeholder
 * hits, publishDate and Strapi createdAt (a publishDate earlier than createdAt
 * is a backdated post). Then duplicate clusters: near-identical titles (token
 * Jaccard >= 0.6) or bodies (5-word shingle Jaccard >= 0.4).
 *
 * "Indexable" means what the site will actually publish: not held back by the
 * editorial guard (lib/editorial-guard.mjs) and not merged away in
 * data/merged-articles.json. Read-only — it never writes to Strapi.
 */
import fs from 'node:fs';
import path from 'node:path';
import { editorialHits, postTexts } from '../lib/editorial-guard.mjs';
import { mergedSlugTargets } from '../lib/merged-articles.mjs';

const ROOT = process.cwd();
const JSON_OUT = process.argv.includes('--json');

function env(name) {
  if (process.env[name]) return process.env[name].trim();
  for (const f of ['.env.local', '.env']) {
    const p = path.join(ROOT, f);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
      const m = line.match(new RegExp(`^\\s*${name}\\s*=\\s*(.*)\\s*$`));
      if (m) return m[1].replace(/^["']|["']$/g, '').trim();
    }
  }
  return '';
}


async function fetchPosts() { const rows = await cmsDocuments('posts', { includeScheduled: true }); await closeCMS(); return rows; }

// --- similarity -------------------------------------------------------------

const STOP = new Set(
  'a an and are as at be best by can do does for from guide how i in is it its of on or should the to vs what when which who why will with without you your'.split(' '),
);

function titleTokens(title) {
  return new Set(
    String(title)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .split(' ')
      .filter((w) => w && !STOP.has(w))
      .map((w) => (w === 'aussie' || w === 'australian' ? 'australia' : w))
      .map((w) => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w)),
  );
}

function shingles(body, n = 5) {
  const words = String(body)
    .toLowerCase()
    .replace(/::product:[^:]+::/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter(Boolean);
  const out = new Set();
  for (let i = 0; i + n <= words.length; i += 1) out.add(words.slice(i, i + n).join(' '));
  return out;
}

function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter += 1;
  return inter / (a.size + b.size - inter);
}

// --- main -------------------------------------------------------------------

const merged = Object.fromEntries(mergedSlugTargets(ROOT));
const posts = (await fetchPosts()).map((p) => {
  const body = String(p.content ?? '');
  const hits = editorialHits(postTexts(p));
  const verify = hits.find((h) => h.label === '[VERIFY')?.count ?? 0;
  const placeholders = hits.filter((h) => h.label !== '[VERIFY');
  return {
    slug: p.slug,
    title: p.title,
    category: p.categories?.[0]?.slug ?? '',
    author: p.author?.name ?? p.author?.slug ?? '(editorial)',
    words: body.trim().split(/\s+/).filter(Boolean).length,
    verify,
    placeholders,
    publishDate: p.publishDate ?? '',
    createdAt: p.createdAt ?? '',
    backdated: Boolean(p.publishDate && p.createdAt && new Date(p.publishDate) < new Date(p.createdAt.slice(0, 10))),
    mergedInto: merged[p.slug] ?? null,
    blocked: hits.length > 0,
    _title: titleTokens(p.title),
    _body: shingles(body),
  };
});

const indexable = posts.filter((p) => !p.blocked && !p.mergedInto);

// Clusters over the indexable set: that is what a reviewer sees.
function clustersOf(list) {
  const parent = new Map(list.map((p) => [p.slug, p.slug]));
  const find = (x) => (parent.get(x) === x ? x : (parent.set(x, find(parent.get(x))), parent.get(x)));
  const pairs = [];
  for (let i = 0; i < list.length; i += 1) {
    for (let j = i + 1; j < list.length; j += 1) {
      const t = jaccard(list[i]._title, list[j]._title);
      const b = jaccard(list[i]._body, list[j]._body);
      if (t >= 0.6 || b >= 0.4) {
        pairs.push({ a: list[i].slug, b: list[j].slug, title: +t.toFixed(2), body: +b.toFixed(2) });
        parent.set(find(list[i].slug), find(list[j].slug));
      }
    }
  }
  const groups = new Map();
  for (const p of list) {
    const root = find(p.slug);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(p);
  }
  return {
    pairs,
    clusters: [...groups.values()]
      .filter((g) => g.length > 1)
      .map((g) => g.map((p) => ({ slug: p.slug, category: p.category, words: p.words, title: p.title }))),
  };
}

const all = clustersOf(posts);
const live = clustersOf(indexable);

const report = {
  totals: {
    published: posts.length,
    blocked: posts.filter((p) => p.blocked).length,
    merged: posts.filter((p) => p.mergedInto).length,
    indexable: indexable.length,
    indexableWithMarkers: indexable.filter((p) => p.verify || p.placeholders.length).length,
    duplicateClustersAll: all.clusters.length,
    duplicateClustersIndexable: live.clusters.length,
    backdated: posts.filter((p) => p.backdated).length,
  },
  posts: posts.map(({ _title, _body, ...rest }) => rest),
  duplicates: { all, indexable: live },
};

if (JSON_OUT) {
  console.log(JSON.stringify(report, null, 2));
} else {
  const pad = (s, n) => String(s).slice(0, n).padEnd(n);
  console.log(`${pad('slug', 58)} ${pad('author', 16)} ${pad('words', 5)} ${pad('VER', 3)} ${pad('placeholders', 22)} ${pad('publish', 10)} ${pad('created', 10)} status`);
  for (const p of report.posts) {
    const status = p.mergedInto ? `merged -> ${p.mergedInto}` : p.blocked ? 'BLOCKED' : 'ok';
    console.log(
      `${pad(p.slug, 58)} ${pad(p.author, 16)} ${pad(p.words, 5)} ${pad(p.verify, 3)} ${pad(p.placeholders.map((h) => `${h.label}x${h.count}`).join(',') || '-', 22)} ${pad(p.publishDate.slice(0, 10), 10)} ${pad(p.createdAt.slice(0, 10), 10)} ${status}${p.backdated ? ' (backdated)' : ''}`,
    );
  }
  console.log('\nDuplicate clusters among indexable posts:');
  if (!live.clusters.length) console.log('  none');
  for (const c of live.clusters) {
    console.log(`  - ${c.map((p) => `${p.category}/${p.slug} (${p.words}w)`).join('\n    ')}`);
  }
  console.log('\nSimilar pairs (indexable):');
  for (const p of live.pairs) console.log(`  ${p.a} <> ${p.b}  title=${p.title} body=${p.body}`);
  console.log('\nTotals:', JSON.stringify(report.totals));
}

process.exit(0);
