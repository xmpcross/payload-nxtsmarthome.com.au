import type { Metadata } from 'next';
import Link from 'next/link';
import JsonLd from '@/components/JsonLd';
import PageHeader from '@/components/PageHeader';
import { pageCount } from '@/components/Pagination';
import { articleHref, categoriesWithCounts, getAllArticles } from '@/lib/content';
import { getAllAuthors, resolveAuthor } from '@/lib/authors';
import { getShoppableTopProducts } from '@/lib/products';
import { breadcrumbJsonLd } from '@/lib/seo';
import { site } from '@/lib/site';

/**
 * Human sitemap.
 *
 * The XML sitemap is for crawlers and unreadable to anyone else; this is the
 * same tree for a person, and a second internal path to every page — useful for
 * the product pages in particular, which are otherwise reachable only through
 * their category listing.
 *
 * Everything is derived from the same sources the XML sitemap uses, so the two
 * cannot disagree about what exists.
 */

const DESCRIPTION =
  'Every page on NXT Smart Home in one place — articles by topic, the product catalogue, contributors and site information.';

export const metadata: Metadata = {
  title: 'Sitemap',
  description: DESCRIPTION,
  alternates: { canonical: '/sitemap/' },
};

const SITE_PAGES: Array<{ href: string; label: string }> = [
  { href: '/', label: 'Home' },
  { href: '/articles/', label: 'All articles' },
  { href: '/all-topics/', label: 'Topics and categories' },
  { href: '/products/', label: 'Product catalogue' },
  { href: '/about/', label: 'About this site' },
  { href: '/how-we-test/', label: 'How we research' },
  { href: '/contact/', label: 'Contact' },
  { href: '/affiliate-disclosure/', label: 'Affiliate disclosure' },
  { href: '/privacy/', label: 'Privacy policy' },
  { href: '/terms/', label: 'Terms and conditions' },
  { href: '/cookies/', label: 'Cookie information' },
];

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-slate-200 py-8 first:border-t-0 first:pt-0 dark:border-card-edge">
      <h2 className="mb-4 flex items-baseline gap-3 text-xl font-bold text-slate-900 dark:text-white">
        {title}
        {typeof count === 'number' && (
          <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{count}</span>
        )}
      </h2>
      {children}
    </section>
  );
}

const linkClass =
  'text-sm text-slate-600 underline-offset-2 hover:text-brand-700 hover:underline dark:text-slate-300 dark:hover:text-brand-400';

// Refreshes with the article data (ISR, 5 minutes); without it this page was
// frozen at the last deploy, like /articles/ was.
export const revalidate = 300;

export default async function SitemapPage() {
  const articles = await getAllArticles();
  // Empty listings are never linked (lib/products.ts isEmptyListing).
  const products = (await getShoppableTopProducts());
  // Only bylines with something published, matching sitemap.xml.
  const authors = getAllAuthors().filter((author) =>
    articles.some((a) => resolveAuthor(a.author).slug === author.slug),
  );
  const cats = categoriesWithCounts(articles).filter((c) => c.count > 0);

  const productCats = Array.from(
    products.reduce((map, p) => {
      if (!p.categorySlug) return map;
      const entry = map.get(p.categorySlug) ?? { name: p.categoryName ?? p.categorySlug, items: [] as typeof products };
      entry.items.push(p);
      map.set(p.categorySlug, entry);
      return map;
    }, new Map<string, { name: string; items: typeof products }>()),
  ).sort((a, b) => a[1].name.localeCompare(b[1].name));

  const articlePages = Array.from({ length: Math.max(0, pageCount(articles.length) - 1) }, (_, i) => i + 2);

  return (
    <div className="container py-14 lg:py-20">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'Sitemap', path: '/sitemap/' },
        ])}
      />

      <PageHeader
        eyebrow="Site index"
        title="Sitemap"
        intro={DESCRIPTION}
        meta={`${articles.length} articles · ${products.length} products · ${cats.length} topics`}
      />

      {/*
        The XML sitemap is what search engines read. Linking it here is the
        conventional pairing, and it is the one link on this page that is not
        for a human — hence the note rather than a bare URL.
      */}
      <p className="mb-10 rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600 dark:border-card-edge dark:bg-card dark:text-slate-300">
        Search engines read the{' '}
        <a
          href={`${site.url}/sitemap.xml`}
          className="font-semibold text-brand-700 underline underline-offset-2 hover:text-brand-800 dark:text-brand-400"
        >
          XML sitemap
        </a>
        , which lists every indexable URL with its last-modified date. This page is the same
        tree, for people.
      </p>

      <Section title="Site pages" count={SITE_PAGES.length}>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {SITE_PAGES.map((p) => (
            <li key={p.href}>
              <Link href={p.href} className={linkClass}>{p.label}</Link>
            </li>
          ))}
          {articlePages.map((n) => (
            <li key={n}>
              <Link href={`/articles/page/${n}/`} className={linkClass}>
                All articles — page {n}
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      {cats.map((c) => {
        const inCategory = articles.filter((a) => a.categoryMeta?.slug === c.slug);
        return (
          <Section key={c.slug} title={c.name} count={inCategory.length}>
            <p className="mb-3">
              <Link href={`/categories/${c.slug}/`} className="text-sm font-semibold text-brand-700 hover:underline dark:text-brand-400">
                Browse {c.name} →
              </Link>
            </p>
            <ul className="grid gap-2 sm:grid-cols-2">
              {inCategory.map((a) => (
                <li key={a.slug}>
                  <Link href={articleHref(a)} className={linkClass}>{a.title}</Link>
                </li>
              ))}
            </ul>
          </Section>
        );
      })}

      {productCats.map(([slug, { name, items }]) => (
        <Section key={slug} title={`${name} products`} count={items.length}>
          <p className="mb-3">
            <Link href={`/products/category/${slug}/`} className="text-sm font-semibold text-brand-700 hover:underline dark:text-brand-400">
              Browse {name} products →
            </Link>
          </p>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((p) => (
              <li key={p.slug}>
                <Link href={`/products/${p.slug}/`} className={linkClass}>{p.name}</Link>
              </li>
            ))}
          </ul>
        </Section>
      ))}

      <Section title="Contributors" count={authors.length}>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {authors.map((a) => (
            <li key={a.slug}>
              <Link href={`/authors/${a.slug}/`} className={linkClass}>{a.name}</Link>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
