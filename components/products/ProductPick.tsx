import Link from 'next/link';
import AffiliateLink from '@/components/AffiliateLink';
import { FOCUS } from '@/components/category/shared';
import { articleHref, type Article } from '@/lib/content';
import type { TopProduct } from '@/lib/products';
import StarRating from '@/components/StarRating';
import { reviewSummary } from '@/lib/review-sources';
import { responsiveImg } from '@/lib/image'

/**
 * A product a guide discusses: picture, name, the verdict on who it suits, the
 * guide it appears in, and the way to buy. No price (prices change daily; the
 * retailer shows the current one) and no rating (nothing here was tested).
 */
export default function ProductPick({ product, guide }: { product: TopProduct; guide?: Article }) {
  const retailer = product.retailers?.find((r) => r.primary) ?? product.retailers?.[0];
  const href = `/products/${product.slug}/`;

  return (
    <article className="grid h-full grid-cols-[5.5rem_minmax(0,1fr)] gap-x-4 border-t border-neutral-200 pt-5 sm:flex sm:flex-col dark:border-neutral-800">
      <Link href={href} className={`group row-span-6 block self-start ${FOCUS}`} tabIndex={-1} aria-hidden="true">
        <span className="flex aspect-square items-center justify-center rounded-lg bg-white p-2 ring-1 ring-neutral-200 sm:aspect-[4/3] sm:p-4 dark:ring-neutral-800">
          {product.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              {...responsiveImg(product.image, 384, '(max-width: 640px) 50vw, 16rem')}
              alt=""
              width={240}
              height={180}
              loading="lazy"
              className="max-h-full w-auto object-contain transition-transform duration-300 group-hover:scale-[1.03]"
            />
          ) : null}
        </span>
      </Link>

      <p className="text-sm text-neutral-600 sm:mt-4 dark:text-neutral-400">
        {product.brand}
        {product.subCategory ? ` · ${product.subCategory}` : ''}
      </p>
      <h3 className="mt-1 text-lg leading-snug font-bold text-neutral-900 dark:text-white">
        <Link href={href} className={`hover:text-primary-600 hover:underline hover:underline-offset-4 dark:hover:text-primary-400 ${FOCUS}`}>
          {product.name}
        </Link>
      </h3>
      {(() => { const s = reviewSummary(product); return <div className="mt-1.5"><StarRating rating={s.rating} count={s.reviewCount} /></div>; })()}
      {product.bestFor ? (
        <p className="mt-2 text-neutral-700 dark:text-neutral-300">
          <span className="font-semibold text-neutral-900 dark:text-white">Suits: </span>
          {product.bestFor}
        </p>
      ) : null}
      {guide ? (
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          In our guide:{' '}
          <Link
            href={articleHref(guide)}
            className={`font-semibold text-primary-600 underline underline-offset-4 dark:text-primary-400 ${FOCUS}`}
          >
            {guide.title}
          </Link>
        </p>
      ) : null}

      <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 pt-4 sm:pt-5">
        {retailer ? (
          <AffiliateLink
            href={retailer.url}
            subId={`product-pick-${product.slug}`}
            className={`inline-flex items-center rounded-full bg-primary-600 px-4 py-2 text-sm font-bold text-white hover:bg-primary-700 ${FOCUS}`}
          >
            Check price at {retailer.name}
          </AffiliateLink>
        ) : null}
        <Link
          href={href}
          className={`text-sm font-semibold text-neutral-700 underline underline-offset-4 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white ${FOCUS}`}
        >
          Details
        </Link>
      </div>
    </article>
  );
}
