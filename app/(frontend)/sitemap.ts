import { cmsDocuments } from '@/lib/cms';
import type { MetadataRoute } from 'next';
import { articleHref, getAllArticles, type Article } from '@/lib/content';
import { getIndexableTopProducts } from '@/lib/products';
import { categories, site } from '@/lib/site';
import { getAllAuthors, resolveAuthor } from '@/lib/authors';

/*
 * Regenerated every 5 minutes, like the article pages and listings. At an hour
 * a newly published post could be live, linked and crawled before it reached
 * the sitemap (audit S3: the automation explainer published 16 Oct was missing
 * from the crawl's copy of the sitemap).
 */
export const revalidate = 300;

/** A valid Date from an ISO string, or undefined. */
function toDate(value: string | undefined | null): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/** When an article last changed: its modified date, else its publish date. */
function articleModified(article: Article): Date | undefined {
  return toDate(article.updated) ?? toDate(article.date);
}

/** Latest of a set of dates, or undefined when there are none. */
function latest(dates: Array<Date | undefined>): Date | undefined {
  let max: Date | undefined;
  for (const d of dates) if (d && (!max || d > max)) max = d;
  return max;
}

/**
 * Every indexable page.
 *
 * The paginated /articles/page/N/ listings stay out (AdSense Task 10, 24 Sep
 * 2026): /articles/ lists every article and the paginated URLs redirect to it.
 *
 * /search/, /preview/ and /design-preview/ stay out — robots.txt disallows them,
 * and a sitemap that lists a disallowed URL is a contradiction Search Console
 * reports back.
 *
 * lastmod is the real change date of what each page shows (audit S1): an
 * article's modified date; for a listing, the newest change among the items it
 * lists — a category hub moves when one of its own articles changes, not when
 * any article on the site does. A URL with no known date carries no lastmod
 * rather than a made-up one. changefreq and priority are omitted: Google
 * ignores both.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const articles = await getAllArticles();
  const cmsPages = await cmsDocuments('pages');
  // Only indexable products (lib/products.ts isIndexableProduct), and only the
  // product-category pages holding at least 3 of them (AdSense Task 2).
  const products = await getIndexableTopProducts();
  // Author pages with nothing published under them are noindex; leave them out.
  const authors = getAllAuthors().filter((author) =>
    articles.some((a) => resolveAuthor(a.author).slug === author.slug),
  );
  const newestArticle = latest(articles.map(articleModified));

  const byProductCategory = new Map<string, typeof products>();
  for (const p of products) {
    if (!p.categorySlug) continue;
    byProductCategory.set(p.categorySlug, [...(byProductCategory.get(p.categorySlug) ?? []), p]);
  }
  const productCategories = [...byProductCategory].filter(([, items]) => items.length >= 3);
  const newestProduct = latest(products.map((p) => toDate(p.updatedAt)));

  const entry = (path: string, lastModified: Date | undefined): MetadataRoute.Sitemap[number] => ({
    url: `${site.url}${path}`,
    ...(lastModified ? { lastModified } : {}),
  });

  return [
    ...cmsPages.map((page: any) => entry(`/${page.slug}/`, toDate(page.updatedAt))),
    // The home page, /articles/ and the two indexes list articles.
    entry('/', newestArticle),
    entry('/articles/', newestArticle),
    entry('/all-topics/', newestArticle),
    entry('/sitemap/', latest([newestArticle, newestProduct])),
    // Only categories with something published; an empty one is noindex.
    ...categories.flatMap((category) => {
      const inCategory = articles.filter((a) => a.category === category.key);
      if (!inCategory.length) return [];
      return [entry(`/categories/${category.slug}/`, latest(inCategory.map(articleModified)))];
    }),
    ...articles.map((article) => entry(articleHref(article), articleModified(article))),
    // The hub only when it lists something indexable (it is noindex otherwise).
    ...(products.length ? [entry('/products/', newestProduct)] : []),
    ...productCategories.map(([slug, items]) =>
      entry(`/products/category/${slug}/`, latest(items.map((p) => toDate(p.updatedAt)))),
    ),
    ...products.map((product) => entry(`/products/${product.slug}/`, toDate(product.updatedAt))),
    ...authors.map((author) =>
      entry(
        `/authors/${author.slug}/`,
        latest(articles.filter((a) => resolveAuthor(a.author).slug === author.slug).map(articleModified)),
      ),
    ),
  ];
}
