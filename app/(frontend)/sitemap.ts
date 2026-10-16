import { cmsDocuments } from '@/lib/cms';
import type { MetadataRoute } from 'next';
import { articleHref, getAllArticles } from '@/lib/content';
import { getIndexableTopProducts } from '@/lib/products';
import { categories, site } from '@/lib/site';
import { getAllAuthors, resolveAuthor } from '@/lib/authors';

// Regenerated hourly by the Node server, so new Strapi posts appear without a rebuild.
export const revalidate = 3600;

/**
 * Every indexable page.
 *
 * The product catalogue, the author profiles and the paginated /articles/ pages
 * were all absent: the sitemap listed 67 URLs against 298 built pages, so 215
 * product pages had no path in it at all and relied on being found by crawl
 * alone.
 *
 * The paginated /articles/page/N/ listings were taken back out (AdSense Task
 * 10, 24 Sep 2026): they are ~230-word card grids, not destinations, and stay
 * reachable through /articles/ pagination. Page one, /articles/, stays.
 *
 * /search/, /preview/ and /design-preview/ stay out — robots.txt disallows them,
 * and a sitemap that lists a disallowed URL is a contradiction Search Console
 * reports back.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const articles = await getAllArticles();
  const cmsPages = await cmsDocuments('pages');
  // Only indexable products (lib/products.ts isIndexableProduct), and only the
  // product-category pages holding at least 3 of them (AdSense Task 2).
  const products = (await getIndexableTopProducts());
  // Author pages with nothing published under them are noindex; leave them out.
  const authors = getAllAuthors().filter((author) =>
    articles.some((a) => resolveAuthor(a.author).slug === author.slug),
  );
  const newest = articles[0]?.date ? new Date(articles[0].date) : new Date();

  const perCategory = new Map<string, number>();
  for (const p of products) perCategory.set(p.categorySlug, (perCategory.get(p.categorySlug) ?? 0) + 1);
  const productCategories = [...perCategory].filter(([slug, n]) => slug && n >= 3).map(([slug]) => slug);

  const staticPages = [
    { path: '/', priority: 1.0, changeFrequency: 'daily' as const },
    { path: '/articles/', priority: 0.9, changeFrequency: 'daily' as const },
    { path: '/all-topics/', priority: 0.7, changeFrequency: 'weekly' as const },
    { path: '/sitemap/', priority: 0.3, changeFrequency: 'weekly' as const },
  ];

  return [
    ...cmsPages.map((page:any)=>({url:`${site.url}/${page.slug}/`,lastModified:new Date(page.updatedAt),changeFrequency:'yearly' as const,priority:0.4})),
    ...staticPages.map((page) => ({
      url: `${site.url}${page.path}`,
      lastModified: newest,
      changeFrequency: page.changeFrequency,
      priority: page.priority,
    })),
    // Only categories with something published; an empty one is noindex.
    ...categories
      .filter((category) => articles.some((a) => a.category === category.key))
      .map((category) => ({
        url: `${site.url}/categories/${category.slug}/`,
        lastModified: newest,
        changeFrequency: 'weekly' as const,
        priority: 0.7,
      })),
    ...articles.map((article) => ({
      url: `${site.url}${articleHref(article)}`,
      lastModified: new Date(article.updated ?? article.date),
      changeFrequency: 'monthly' as const,
      priority: article.featured ? 0.9 : 0.8,
    })),
    // The hub only when it lists something indexable (it is noindex otherwise).
    ...(products.length
      ? [{ url: `${site.url}/products/`, lastModified: newest, changeFrequency: 'daily' as const, priority: 0.8 }]
      : []),
    ...productCategories.map((slug) => ({
      url: `${site.url}/products/category/${slug}/`,
      lastModified: newest,
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    })),
    ...products.map((product) => ({
      url: `${site.url}/products/${product.slug}/`,
      lastModified: product.updatedAt ? new Date(product.updatedAt) : newest,
      // Prices move, so these are worth recrawling more often than an article.
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    })),
    ...authors.map((author) => ({
      url: `${site.url}/authors/${author.slug}/`,
      lastModified: newest,
      changeFrequency: 'monthly' as const,
      priority: 0.4,
    })),
  ];
}
