import { cmsDocuments, closeCMS } from '../lib/cms.ts';
/**
 * Generates public/search-index.json for the client-side search page.
 * Runs automatically before every build via the `prebuild` npm script.
 *
 * Deliberately standalone (no TypeScript imports) so it can run before Next compiles.
 */
import fs from 'node:fs';
import path from 'node:path';
import { editorialHits, guardMode, postTexts } from '../lib/editorial-guard.mjs';
import { mergedSlugTargets } from '../lib/merged-articles.mjs';

const root = process.cwd();
const outFile = path.join(root, 'public', 'search-index.json');

// Mirrors the category list in lib/site.ts — key to display name.
const categorySlugs = {
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

const categoryNames = {
  security: 'Security & Cameras',
  lighting: 'Lighting',
  energy: 'Energy & Solar',
  entertainment: 'Entertainment & Audio',
  climate: 'Climate & Comfort',
  'hubs-and-platforms': 'Hubs & Platforms',
  'robot-vacuums': 'Robot Vacuums',
  'setup-guides': 'Setup Guides',
  'buying-guides': 'Buying Guides',
};

function toPlainText(markdown) {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`|-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Cover URL with the same content-hash cache-buster coverFor() applies in
 * lib/content.ts. Without it the modal's thumbnails keep serving a stale image
 * from the 30-day cache after a cover is regenerated.
 */
/** Absolute URL for a Strapi media path (uploads are served by the CMS). */
function mediaUrl(url) {
  if (!url) return '';
  return url;
}

function coverUrl(slug) {
  for (const ext of ['webp', 'png']) {
    try {
      const file = path.join(root, 'public', 'covers', `${slug}.${ext}`);
      const { size, mtimeMs } = fs.statSync(file);
      const v = (size ^ Math.round(mtimeMs)).toString(36).slice(-6);
      return `/covers/${slug}.${ext}?v=${v}`;
    } catch {
      /* try the next extension */
    }
  }
  return `/covers/${slug}.png`;
}

/*
 * Built from the CMS, not from content/articles/.
 *
 * The site started reading posts from Payload; this kept reading the markdown,
 * so the index silently described a different set of articles than the site
 * served. The first thing published only in the CMS was live on the site and
 * absent from search, with nothing failing to say so.
 */
const STRAPI = (process.env.SITE_URL || 'https://nxtsmarthome.com.au').replace(/\/$/, '');

const params = new URLSearchParams({
  status: 'published',
  'pagination[pageSize]': '200',
  'sort[0]': 'publishDate:desc',
  'populate[categories]': 'true',
  'populate[coverImage]': 'true',
  // FAQ text is checked by the editorial guard below.
  'populate[faq]': 'true',
  // Scheduled posts (showFrom in the future) stay out of search until released,
  // matching lib/strapi.ts.
  'filters[$or][0][showFrom][$null]': 'true',
  'filters[$or][1][showFrom][$lte]': new Date().toISOString(),
});

const rows = await cmsDocuments('posts');
await closeCMS();

/* The CMS relates a post to a category by URL slug; this file keys off the
   category KEY, the same split lib/content.ts bridges. */
const keyBySlug = Object.fromEntries(
  Object.entries(categorySlugs).map(([key, slug]) => [slug, key]),
);

// Same hold-back as lib/content.ts: unfinished posts ([VERIFY] or placeholder
// text) and merged near-duplicates are not searchable, since their pages 404/301.
const merged = mergedSlugTargets(root);
const heldBack = [];

const docs = rows
  .map((row) => {
    const a = row.attributes ?? row;
    if (!a.slug || !a.title) return null;
    if (merged.has(a.slug)) return null;
    const hits = editorialHits(postTexts(a));
    if (hits.length) {
      heldBack.push(`${a.slug} (${hits.map((h) => `${h.label} x${h.count}`).join(', ')})`);
      if (guardMode() === 'block') return null;
    }
    const catSlug = a.categories?.[0]?.slug ?? '';
    const key = keyBySlug[catSlug] ?? catSlug;
    const body = toPlainText(String(a.content ?? ''));
    return {
      slug: a.slug,
      title: a.title,
      description: a.excerpt ?? '',
      category: key,
      categoryName: categoryNames[key] ?? a.categories?.[0]?.name ?? '',
      // Shaped like Article.categoryMeta so articleHref() works on a search doc
      // unchanged — otherwise every result would fall back to /articles/<slug>/.
      categoryMeta: { slug: categorySlugs[key] ?? catSlug ?? 'articles' },
      type: a.postType ?? '',
      date: a.showFrom ?? a.publishDate ?? a.publishedAt ?? '',
      tags: Array.isArray(a.tags) ? a.tags : [],
      readingMinutes:
        a.readingTimeMinutes || Math.max(1, Math.round(body.split(/\s+/).length / 225)),
      // Same order as lib/content.ts: the uploaded Cover Image wins, then
      // coverImageUrl, then a generated file in public/covers. Before this the
      // uploaded image was ignored and 23 of 48 results pointed at a missing
      // /covers/<slug>.png.
      cover: mediaUrl(a.coverImage?.url) || a.coverImageUrl || coverUrl(a.slug),
      body: body.slice(0, 1200),
    };
  })
  .filter(Boolean)
  .sort((a, b) => new Date(b.date) - new Date(a.date));

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(docs));
console.log(`[search-index] wrote ${docs.length} documents from Payload to public/search-index.json`);
if (heldBack.length) {
  console.log(
    `[editorial-guard] search index: ${guardMode() === 'warn' ? 'WARN, still indexed' : 'held back'} ` +
      `${heldBack.length} post(s): ${heldBack.join('; ')}`,
  );
}

process.exit(0);
