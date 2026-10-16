import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import AffiliateLink from '@/components/AffiliateLink';
import ProductAccordion from '@/components/ProductAccordion';
import ProductHighlights from '@/components/ProductHighlights';
import ProductReviews from '@/components/ProductReviews';
import RelatedProducts from '@/components/RelatedProducts';
import RetailerPriceList from '@/components/RetailerPriceList';
import RetailerPriceTable from '@/components/RetailerPriceTable';
import JsonLd from '@/components/JsonLd';
import { bulletsOf } from '@/lib/bullets';
import { AFFILIATE_ENABLED } from '@/lib/affiliate';
import { getAllProducts, getAllTopProducts, getCuratedProduct, getProductBySlug, getShoppableTopProducts, getTopProductBySlug, isIndexableProduct } from '@/lib/products';
import ProductEditorial from '@/components/ProductEditorial';
import { breadcrumbJsonLd, productJsonLd } from '@/lib/seo';
import { retailerReviews } from '@/lib/review-sources';
import { responsiveImg } from '@/lib/image'

export async function generateStaticParams() {
  const products = (await getAllTopProducts());
  return products.map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = (await getTopProductBySlug(slug));
  if (!product) return {};

  const fullName = `${product.brand ? product.brand + ' ' : ''}${product.name}`;
  const indexable = isIndexableProduct(product);
  /*
   * Indexable (curated) pages: bestFor plus the first sentence of the curated
   * verdict. Price listings are noindex, so they keep the plain where-to-buy
   * line rather than one that reads like a recommendation.
   */
  const verdict = (await getAllProducts())
    .find((p) => p.slug === product.slug)
    ?.note?.replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .match(/^.*?[.!?](\s|$)/)?.[0]
    ?.trim();
  const bestFor = (await getCuratedProduct(product.slug))?.bestFor || product.bestFor;
  const description = indexable
    ? [bestFor ? `${fullName}: ${bestFor.replace(/\.$/, '')}.` : fullName, verdict].filter(Boolean).join(' ')
    : `Where to buy ${fullName} in Australia. Compare prices at Australian retailers.`;

  return {
    // "Review" dropped from the title: none of these pages is one.
    title: `${fullName} Price in Australia`,
    description,
    alternates: { canonical: `/products/${product.slug}/` },
    // Price listings stay out of the index but keep passing link equity
    // (lib/products.ts isIndexableProduct).
    ...(indexable ? {} : { robots: { index: false, follow: true } }),
  };
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = (await getTopProductBySlug(slug));
  if (!product) notFound();

  // Related products: same subcategory first, then the wider category. Variants
  // of this same product ("… Pro", "… Ultra") are excluded — they are near
  // duplicates of the page you are already on, not alternatives to it.
  const baseSlug = (s: string) => s.replace(/-(pro|ultra|gen-\d+)$/, '');
  const thisBase = baseSlug(product.slug);
  // Empty listings are never linked (lib/products.ts isEmptyListing).
  const pool = (await getShoppableTopProducts()).filter((p) => baseSlug(p.slug) !== thisBase);
  const sameSubCategory = product.subCategory
    ? pool.filter((p) => p.subCategory === product.subCategory)
    : [];
  const relatedProducts = [
    ...sameSubCategory,
    ...pool.filter((p) => p.categorySlug === product.categorySlug && !sameSubCategory.includes(p)),
  ].slice(0, 6); // one row of six on desktop

  const isListingOnly = !isIndexableProduct(product);
  // What the client components receive, with reviews already cut down to the
  // named Australian retailers (lib/review-sources.ts). A client component's
  // props are serialised into the page, so filtering inside ProductReviews
  // alone still shipped every AliExpress and Shopee review in the HTML.
  // The curated file's verdict line, when there is one, beats the catalogue's.
  const curated = (await getCuratedProduct(product.slug));
  const forClient = {
    ...product,
    bestFor: curated?.bestFor || product.bestFor,
    reviews: retailerReviews(product).reviews,
  };
  // Curated editorial merged over the catalogue record (lib/products.ts).
  const editorial = curated ? (await getProductBySlug(product.slug)) : undefined;
  const retailers = product.retailers || [];
  const primaryRetailer = retailers.find((r) => r.primary) || retailers[0];

  /*
   * The headline price is the cheapest verified retailer price, not the seeded
   * `priceAud` — that figure came from the original generator and was never a
   * real RRP. Where no retailer could be priced, no price is shown at all.
   */
  const pricedRetailers = retailers
    .filter((r) => typeof r.priceAud === 'number' && r.priceAud > 0)
    .sort((a, b) => (a.priceAud || 0) - (b.priceAud || 0));
  const cheapest = pricedRetailers[0];
  const ctaRetailer = cheapest || primaryRetailer;

  return (
    /* The page element lives in app/layout.tsx — this is a div, not a second
       <main>, which would be invalid HTML. */
    <div className="bg-[#f0f2f4] dark:bg-slate-900">
      {/* Product and breadcrumb data. This page had neither, so its verified
          retailer pricing was invisible to Google's product results. */}
      <JsonLd data={productJsonLd(product)} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'Products', path: '/products/' },
          { name: product.categoryName, path: `/products/category/${product.categorySlug}/` },
          { name: product.name, path: `/products/${product.slug}/` },
        ])}
      />
      <div className="container py-8 lg:py-12">
        {/* Breadcrumb */}
        <nav className="mb-4 flex flex-wrap items-center gap-2 text-xs font-semibold text-[#55555a] dark:text-slate-400">
          <Link href="/" className="hover:text-[#0046be] dark:hover:text-blue-400">Home</Link>
          <span aria-hidden="true">/</span>
          <Link href="/products/" className="hover:text-[#0046be] dark:hover:text-blue-400">Products</Link>
          <span aria-hidden="true">/</span>
          <Link
            href={`/products/category/${product.categorySlug}/`}
            className="hover:text-[#0046be] dark:hover:text-blue-400"
          >
            {product.categoryName}
          </Link>
        </nav>

        {/* Two-column shell: content left, purchase panel right */}
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(300px,26%)]">
          {/* ---------- Left column ---------- */}
          <div className="flex min-w-0 flex-col gap-5">
            {/* Hero card: gallery beside summary */}
            <div className="grid items-start gap-6 rounded-[8px] bg-white p-5 dark:bg-slate-800 sm:p-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(260px,0.85fr)]">
              {/* Gallery. One image per product in this dataset, so the
                  reference's thumbnail rail has nothing to show and is omitted
                  rather than faked with duplicates. */}
              <div className="flex min-w-0 items-center justify-center rounded-lg bg-white p-4 dark:bg-slate-800">
                <img
                  {...responsiveImg(product.image || '/og-default.png', 640, '(max-width: 768px) 100vw, 480px')}
                  alt={product.brand ? `${product.brand} ${product.name}` : product.name}
                  className="max-h-[380px] w-full object-contain"
                />
              </div>

              {/* Summary */}
              <div className="min-w-0">
                {product.brand ? (
                  <div className="text-sm font-semibold text-[#0046be] dark:text-blue-400">
                    {product.brand}
                  </div>
                ) : null}

                <h1 className="mb-2.5 mt-1.5 text-[1.2rem] font-bold leading-tight text-[#1d252c] dark:text-white">
                  {product.name}
                </h1>

                <div className="mb-4 flex flex-wrap gap-x-5 gap-y-2 text-[0.8125rem] text-[#55555a] dark:text-slate-400">
                  {/* No star score here: next to the product name it reads as
                      our verdict. Retailer customer scores are in the reviews
                      block, labelled as theirs. */}
                  {isListingOnly ? (
                    <span className="rounded-sm border border-[#c5cbd5] px-2 py-0.5 text-[#1d252c] dark:border-slate-600 dark:text-slate-200">
                      <span className="font-semibold">Price listing — not a review.</span>{' '}
                      <Link
                        href={`/categories/${product.categorySlug}/`}
                        className="text-[#0046be] underline underline-offset-2 hover:no-underline dark:text-blue-400"
                      >
                        See our guides for recommendations.
                      </Link>
                    </span>
                  ) : null}
                  {product.subCategory ? (
                    <span>
                      <span className="font-semibold text-[#1d252c] dark:text-slate-200">Type:</span>{' '}
                      {product.subCategory}
                    </span>
                  ) : null}
                </div>

                {/*
                  This block is pinned to 14px, heading included. The body copy
                  was already there via text-sm; the heading was 1.05rem, so it
                  is the part that actually moves. Set in px rather than text-sm
                  so it holds if the rem scale is ever changed — the request was
                  a size, not a step on the scale.
                */}
                {product.shortDescription || product.description || product.bestFor ? (
                  <div className="border-t border-[#e0e0e0] pt-4 text-[14px] dark:border-slate-700">
                    <h2 className="mb-2.5 text-[14px] font-bold text-[#1d252c] dark:text-white">
                      About this product
                    </h2>
                    {/*
                      The blurb written in the CMS comes first. It is the one
                      someone edited for this product; the manufacturer's copy
                      and the editorial verdict are fallbacks for anything not
                      rewritten yet.

                      Bulleted copy is rendered as a real list. It arrives as
                      lines beginning with "•", and a paragraph would print those
                      characters as text — and, with line-clamp, run the bullets
                      together mid-sentence.
                    */}
                    {product.shortDescription && bulletsOf(product.shortDescription).length > 1 ? (
                      <ul className="space-y-1.5 leading-relaxed text-[#55555a] dark:text-slate-300">
                        {bulletsOf(product.shortDescription).map((line) => (
                          <li key={line} className="flex gap-2">
                            <span
                              aria-hidden="true"
                              className="mt-[0.4rem] h-1.5 w-1.5 shrink-0 rounded-full bg-[#55555a] dark:bg-slate-400"
                            />
                            <span>{line}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="line-clamp-5 leading-relaxed text-[#55555a] dark:text-slate-300">
                        {product.shortDescription || product.description || product.bestFor}
                      </p>
                    )}
                  </div>
                ) : null}
              </div>
            </div>

            {/* Curated research notes (content/products/<slug>.md), when written. */}
            {editorial ? <ProductEditorial product={editorial} /> : null}

            {/* Highlights sit above the Description panels */}
            <ProductHighlights product={forClient} />

            {/* Description / Specifications / Additional Info */}
            <ProductAccordion product={forClient} />

            {/* Reviews sit directly beneath the Additional Info panel */}
            <ProductReviews product={forClient} />
          </div>

          {/* ---------- Right column: purchase panel ---------- */}
          <aside className="lg:sticky lg:top-20">
            <div className="rounded-[8px] border border-[#e0e0e0] bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
              {cheapest ? (
                <>
                  <p className="text-xs font-semibold uppercase tracking-wider text-[#55555a] dark:text-slate-400">
                    Lowest price
                  </p>
                  <div className="mt-1 text-[1.875rem] font-bold leading-none text-[#1d252c] dark:text-white">
                    ${cheapest.priceAud!.toLocaleString('en-AU', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </div>
                  <p className="mt-1.5 text-[0.8125rem] text-[#55555a] dark:text-slate-400">
                    at {cheapest.name}
                    {pricedRetailers.length > 1
                      ? ` · ${pricedRetailers.length} retailers compared`
                      : ''}
                  </p>
                </>
              ) : (
                <p className="text-sm text-[#55555a] dark:text-slate-300">
                  We could not verify a current Australian price for this product. Check the
                  retailers below.
                </p>
              )}

              <div className="my-5">
                <RetailerPriceList
                  retailers={retailers}
                  subId={`buybox-${product.slug}`}
                  pricesCheckedAt={product.pricesCheckedAt}
                />
              </div>

              {ctaRetailer ? (
                <AffiliateLink
                  href={ctaRetailer.url}
                  subId={`detail-cta-${product.slug}`}
                  className="block w-full rounded-sm bg-[#ffe000] px-4 py-3.5 text-center text-sm font-bold text-[#040c13] transition hover:bg-[#fff200]"
                >
                  {cheapest ? `Buy at ${ctaRetailer.name}` : `Check price at ${ctaRetailer.name}`}
                </AffiliateLink>
              ) : null}

              {AFFILIATE_ENABLED && (
                <p className="mt-3 text-center text-[0.6875rem] leading-relaxed text-[#55555a] dark:text-slate-400">
                  We may earn a commission from links on this page, at no extra cost to you.
                </p>
              )}
            </div>
          </aside>
        </div>

        {/* Retailer Price Comparison Table */}
        <RetailerPriceTable
          productName={product.name}
          retailers={product.retailers}
          subId={`detail-table-${product.slug}`}
          pricesCheckedAt={product.pricesCheckedAt}
        />

        {/* Related products — six per row on desktop */}
        <RelatedProducts products={relatedProducts} />
      </div>
    </div>
  );
}
