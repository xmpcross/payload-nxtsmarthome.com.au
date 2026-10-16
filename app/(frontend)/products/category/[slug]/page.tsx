import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import JsonLd from '@/components/JsonLd';
import { FOCUS, typeLabel } from '@/components/category/shared';
import ProductCatalogue from '@/components/products/ProductCatalogue';
import ProductPick from '@/components/products/ProductPick';
import { toCatalogueItem } from '@/components/products/catalogue-item';
import { articleHref, getAllArticles } from '@/lib/content';
import { guideMentions } from '@/lib/product-mentions';
import { getShoppableTopProducts, isIndexableProduct } from '@/lib/products';
import { categories, getCategory, site } from '@/lib/site';
import { metaDescription, pageAlternates, pageTitle } from '@/lib/seo';
import { responsiveImg } from '@/lib/image'

// The picks and guides come from the articles, which refresh from Strapi every 5 minutes.
export const revalidate = 300;

const PICKS = 4;
const GUIDES = 5;

export async function generateStaticParams() {
  return categories.map((category) => ({ slug: category.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const category = getCategory(slug);
  if (!category) return {};

  // A category page listing no indexable product is a page of price listings:
  // noindex, follow (AdSense Task 2).
  const indexableHere = (await getShoppableTopProducts()).filter(
    (p) => p.categorySlug === category.slug && isIndexableProduct(p),
  ).length;

  return {
    // No "best" or "top rated": these are listings, not tested rankings.
    title: pageTitle(`${category.name} Devices in Australia`),
    description: metaDescription(
      `${category.name} devices sold by Australian retailers, with who each suits and where to check the price: Amazon AU, JB Hi-Fi, The Good Guys and more.`,
    ),
    alternates: pageAlternates(`/products/category/${category.slug}/`),
    ...(indexableHere ? {} : { robots: { index: false, follow: true } }),
  };
}

export default async function CategoryProductsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const category = getCategory(slug);
  if (!category) notFound();

  // Empty listings are never listed; their pages still resolve (isEmptyListing).
  const products = (await getShoppableTopProducts()).filter((p) => p.categorySlug === category.slug);
  const articles = await getAllArticles();
  const mentions = guideMentions(articles);

  const picks = products
    .filter((p) => mentions.has(p.slug))
    .sort((a, b) => mentions.get(b.slug)!.length - mentions.get(a.slug)!.length || a.name.localeCompare(b.name))
    .slice(0, PICKS);

  const items = [...products].sort((a, b) => a.name.localeCompare(b.name)).map((p) => toCatalogueItem(p, 'sub'));
  const subOrder = category.subcategories ?? [];
  const groups = [...new Set(items.map((i) => i.group))]
    .sort((a, b) => {
      const ia = subOrder.indexOf(a);
      const ib = subOrder.indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.localeCompare(b);
    })
    .map((g) => ({ key: g, label: g }));

  const guides = articles
    .filter((a) => a.category === category.key)
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
  const base = `/products/category/${category.slug}/`;

  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: `${site.url}/` },
            { '@type': 'ListItem', position: 2, name: 'Products', item: `${site.url}/products/` },
            { '@type': 'ListItem', position: 3, name: category.name, item: `${site.url}${base}` },
          ],
        }}
      />

      <header className="container pt-8 lg:pt-12">
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs font-semibold text-neutral-600 dark:text-neutral-400">
          <Link href="/" className={`hover:text-neutral-900 dark:hover:text-white ${FOCUS}`}>
            Home
          </Link>
          <span aria-hidden="true">/</span>
          <Link href="/products/" className={`hover:text-neutral-900 dark:hover:text-white ${FOCUS}`}>
            Products
          </Link>
          <span aria-hidden="true">/</span>
          <span className="text-neutral-900 dark:text-white" aria-current="page">
            {category.name}
          </span>
        </nav>

        <div className="mt-6 flex items-center gap-4 sm:gap-5">
          {category.icon3d ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img {...responsiveImg(category.icon3d, 72, '72px')} alt="" width={72} height={72} className="size-14 shrink-0 object-contain sm:size-[4.5rem]" />
          ) : null}
          <h1 className="text-4xl font-black tracking-tight text-balance text-neutral-900 sm:text-5xl dark:text-white">
            {category.name} for Australian homes
          </h1>
        </div>

        <p className="mt-5 max-w-[68ch] text-base leading-relaxed text-pretty text-neutral-700 sm:text-lg dark:text-neutral-300">
          {category.intro}
        </p>
        <p className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm text-neutral-600 dark:text-neutral-400">
          {products.length ? (
            <span>
              <span className="tabular-nums font-semibold text-neutral-900 dark:text-white">{products.length}</span>{' '}
              {products.length === 1 ? 'device' : 'devices'}
            </span>
          ) : null}
          {guides.length ? (
            <Link
              href={`/categories/${category.slug}/`}
              className={`font-semibold text-primary-600 underline underline-offset-4 dark:text-primary-400 ${FOCUS}`}
            >
              {category.name} guides
            </Link>
          ) : null}
          <a href="#how-listed" className={`font-semibold text-primary-600 underline underline-offset-4 dark:text-primary-400 ${FOCUS}`}>
            How these are listed
          </a>
        </p>
      </header>

      <main className="container pt-12 pb-20 lg:pt-14 lg:pb-28">
        {products.length === 0 ? (
          <section className="max-w-3xl border-y border-neutral-200 py-8 dark:border-neutral-800">
            <h2 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">No {category.name} devices listed yet</h2>
            <p className="mt-3 text-neutral-700 dark:text-neutral-300">
              <Link href="/products/" className={`font-semibold text-primary-600 underline underline-offset-4 dark:text-primary-400 ${FOCUS}`}>
                See every device
              </Link>
              .
            </p>
          </section>
        ) : null}

        {picks.length ? (
          <section aria-labelledby="picks-heading">
            <h2 id="picks-heading" className="text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl dark:text-white">
              Discussed in our guides
            </h2>
            <p className="mt-2 max-w-[68ch] text-neutral-700 dark:text-neutral-300">
              {category.name} devices that come up in our guides, with the guide that covers each.
            </p>
            <div className="mt-6 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
              {picks.map((product) => (
                <ProductPick key={product.slug} product={product} guide={mentions.get(product.slug)?.[0]} />
              ))}
            </div>
          </section>
        ) : null}

        {products.length ? (
          <section aria-labelledby="every-heading" className={picks.length ? 'mt-20 lg:mt-24' : undefined}>
            <h2 id="every-heading" className="mb-5 text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl dark:text-white">
              Every {category.name} device
            </h2>
            <ProductCatalogue items={items} groups={groups} groupName="Type" />
          </section>
        ) : null}

        {guides.length ? (
          <section aria-labelledby="guides-heading" className="mt-20 lg:mt-24">
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
              <h2 id="guides-heading" className="text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl dark:text-white">
                {category.name} guides
              </h2>
              {guides.length > GUIDES ? (
                <Link
                  href={`/categories/${category.slug}/`}
                  className={`text-sm font-semibold text-primary-600 underline underline-offset-4 dark:text-primary-400 ${FOCUS}`}
                >
                  All {guides.length} guides
                </Link>
              ) : null}
            </div>
            <ul className="mt-5 border-t border-neutral-200 dark:border-neutral-800">
              {guides.slice(0, GUIDES).map((a) => (
                <li key={a.slug} className="border-b border-neutral-200 dark:border-neutral-800">
                  <Link
                    href={articleHref(a)}
                    className={`group flex flex-col gap-1 rounded-sm py-3.5 sm:flex-row sm:items-baseline sm:gap-6 ${FOCUS}`}
                  >
                    <span className="font-semibold text-neutral-900 group-hover:text-primary-600 group-hover:underline group-hover:underline-offset-4 sm:flex-1 dark:text-neutral-100 dark:group-hover:text-primary-400">
                      {a.title}
                    </span>
                    <span className="shrink-0 text-sm text-neutral-600 dark:text-neutral-400">
                      {typeLabel(a.type)} · <span className="tabular-nums">{a.readingMinutes}</span> min read
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section id="how-listed" aria-labelledby="how-listed-heading" className="mt-20 max-w-[68ch] scroll-mt-24 lg:mt-24">
          <h2 id="how-listed-heading" className="text-xl font-bold text-neutral-900 dark:text-white">
            How these products are listed
          </h2>
          <p className="mt-3 leading-relaxed text-neutral-700 dark:text-neutral-300">
            We list devices sold in Australia by a retailer with local warranty support. Prices change daily, so the
            retailer’s site has the current one. These are listings, not reviews: we have not tested these products.
            Devices our guides discuss come first; everything else is listed by name. Some links earn us a commission at no
            extra cost to you, which does not affect what appears here or its order.
          </p>
          <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
            <Link href="/how-we-test/" className={`font-semibold text-primary-600 underline underline-offset-4 dark:text-primary-400 ${FOCUS}`}>
              How we research
            </Link>
            <Link href="/affiliate-disclosure/" className={`font-semibold text-primary-600 underline underline-offset-4 dark:text-primary-400 ${FOCUS}`}>
              Affiliate disclosure
            </Link>
          </p>
        </section>
      </main>
    </>
  );
}
