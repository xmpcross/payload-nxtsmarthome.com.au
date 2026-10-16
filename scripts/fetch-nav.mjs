import { cmsDocuments, closeCMS } from '../lib/cms.ts';
/**
 * Fetch the header navigation from Payload into lib/nav-cache.json.
 *
 * Runs as part of `prebuild`, alongside the search index and redirect map — the
 * nav is build-time data like everything else here, so it is pulled once before
 * the build rather than fetched inside the React tree. A fetch inside a server
 * component cannot work in this project: `output: 'export'` refuses any fetch
 * that is not statically cacheable, so an uncached one is dropped and the page
 * silently renders the fallback instead.
 *
 * Never fails the build. If Strapi is unreachable the existing cache is left
 * untouched and the build carries on with it — or, if there is no cache at all,
 * with the nav derived in lib/site.ts.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const CACHE = path.join(ROOT, 'lib', 'nav-cache.json');
const SITE = 'nxtsmarthome.com.au';

const GROUPS = ['products-root', 'product-categories', 'topics', 'guides', 'latest', 'search'];

function shape(rows) {
  const byGroup = (group) =>
    rows
      .filter((r) => r.group === group)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((r) => ({ href: r.url, label: r.title, ...(r.emoji ? { emoji: r.emoji } : {}) }));

  const [products] = byGroup('products-root');
  const [latest] = byGroup('latest');
  const [search] = byGroup('search');
  const productCategoryNavLinks = byGroup('product-categories');
  const topicNavLinks = byGroup('topics');
  const guideNavLinks = byGroup('guides');

  // A dropdown rendered empty would ship to every page of the site, so a
  // partial payload is rejected outright rather than written to the cache.
  if (!products || !latest || !search) return null;
  if (!productCategoryNavLinks.length || !topicNavLinks.length || !guideNavLinks.length) return null;

  return {
    productsNavLink: products,
    productCategoryNavLinks,
    topicNavLinks,
    guideNavLinks,
    latestNavLink: latest,
    searchLink: search,
  };
}

const qs = new URLSearchParams({
  'filters[site][$eq]': SITE,
  'filters[isActive][$eq]': 'true',
  'sort[0]': 'order:asc',
  'pagination[pageSize]': '200',
});

function keep(reason) {
  const had = fs.existsSync(CACHE);
  console.warn(`[nav] ${reason} — ${had ? 'keeping the existing lib/nav-cache.json' : 'build will use the nav in lib/site.ts'}.`);
  process.exit(0);
}

const json = { data: (await cmsDocuments('navigation')).filter(x => x.isActive) };
await closeCMS();

const rows = (json?.data ?? [])
  .map((d) => ({
    title: String(d.title ?? ''),
    url: String(d.url ?? ''),
    group: String(d.group ?? ''),
    emoji: d.emoji ?? null,
    order: Number(d.order ?? 0),
  }))
  .filter((r) => r.title && r.url && GROUPS.includes(r.group));

const nav = shape(rows);
if (!nav) keep(`Strapi returned an incomplete nav (${rows.length} usable rows)`);

fs.writeFileSync(CACHE, `${JSON.stringify(nav, null, 2)}\n`);
console.log(
  `[nav] ${rows.length} links from Payload -> lib/nav-cache.json ` +
    `(products:1 categories:${nav.productCategoryNavLinks.length} topics:${nav.topicNavLinks.length} guides:${nav.guideNavLinks.length})`,
);

process.exit(0);
