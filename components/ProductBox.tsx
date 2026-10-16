import AffiliateLink from './AffiliateLink';
import type { ProductRef } from '@/lib/content';
import { responsiveImg } from '@/lib/image'

interface Props {
  product: ProductRef;
  /** Article slug — becomes the affiliate subID so you can attribute the click. */
  subId: string;
  rank?: number;
}

function Stars({ rating }: { rating: number }) {
  const rounded = Math.round(rating * 2) / 2;
  return (
    <span className="inline-flex items-center gap-1" aria-label={`${rating} out of 5`}>
      <span className="text-accent-500" aria-hidden="true">
        {'★'.repeat(Math.floor(rounded))}
        {rounded % 1 ? '½' : ''}
      </span>
      <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
        {rating.toFixed(1)}
      </span>
    </span>
  );
}

/**
 * The commercial unit of the site: a product summary with pros/cons and buy buttons.
 * Every buy button routes through AffiliateLink.
 */
export default function ProductBox({ product, subId, rank }: Props) {
  return (
    <div className="not-prose my-8 overflow-hidden rounded-[8px] border border-slate-200 bg-white shadow-xs dark:border-slate-700 dark:bg-slate-800/60">
      <div className="border-b border-slate-100 bg-slate-50 px-5 py-4 dark:border-slate-700 dark:bg-slate-800">
        <div className="flex flex-wrap items-start justify-between gap-3">
          {/*
            The photograph, where the product has one. Catalogue entries all do;
            the hand-written files in content/products/ mostly do not, so this is
            conditional rather than a fixed slot — an empty grey square next to a
            heading looks like a failed image, not a design.
          */}
          {product.image && (
            <img
              {...responsiveImg(product.image, 384, '(max-width: 640px) 50vw, 14rem')}
              alt={product.name}
              width={96}
              height={96}
              loading="lazy"
              className="h-20 w-20 shrink-0 rounded-[8px] bg-white object-contain p-1.5 ring-1 ring-slate-200 dark:ring-slate-700"
            />
          )}
          <div className="min-w-0 flex-1">
            {rank !== undefined && (
              <span className="mb-1 inline-block rounded-sm bg-brand-600 px-2 py-0.5 text-xs font-bold text-white">
                #{rank}
              </span>
            )}
            <p className="text-[1.25rem] font-bold leading-7 text-slate-900 dark:text-white">
              {product.brand ? `${product.brand} ${product.name}` : product.name}
            </p>
            {product.bestFor && (
              <p className="mt-0.5 text-[1.125rem] leading-[1.7] text-slate-600 dark:text-slate-300">
                Best for: {product.bestFor}
              </p>
            )}
          </div>
          {product.rating !== undefined && <Stars rating={product.rating} />}
        </div>
      </div>

      {(product.pros?.length || product.cons?.length) && (
        <div className="grid gap-4 px-5 py-4 sm:grid-cols-2">
          {product.pros?.length ? (
            <div>
              <p className="mb-2 text-base font-semibold leading-[1.625] text-primary-700 dark:text-primary-400">
                What we like
              </p>
              <ul className="space-y-1 text-[1.125rem] leading-[1.7] text-slate-700 dark:text-slate-300">
                {product.pros.map((pro) => (
                  <li key={pro} className="flex gap-2">
                    <span className="text-primary-600" aria-hidden="true">
                      ✓
                    </span>
                    <span>{pro}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {product.cons?.length ? (
            <div>
              <p className="mb-2 text-base font-semibold leading-[1.625] text-rose-700 dark:text-rose-400">
                Worth knowing
              </p>
              <ul className="space-y-1 text-[1.125rem] leading-[1.7] text-slate-700 dark:text-slate-300">
                {product.cons.map((con) => (
                  <li key={con} className="flex gap-2">
                    <span className="text-rose-500" aria-hidden="true">
                      –
                    </span>
                    <span>{con}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}

      {product.retailers?.length ? (() => {
        // Retailers flagged `primary` render as buttons; the rest become a compact
        // line, so a product stocked at seven shops is not a wall of buttons. If a
        // file flags none (older format), the first two stand in.
        const all = product.retailers!;
        const flagged = all.filter((r) => r.primary);
        const primary = flagged.length ? flagged : all.slice(0, 2);
        const secondary = all.filter((r) => !primary.includes(r));

        return (
          <div className="border-t border-slate-100 px-5 py-4 dark:border-slate-700">
            <div className="flex flex-wrap gap-2">
              {primary.map((retailer) => (
                <AffiliateLink
                  key={retailer.name + retailer.url}
                  href={retailer.url}
                  subId={subId}
                  className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
                >
                  <span>Check price at {retailer.name}</span>
                  {retailer.price && (
                    <span className="rounded-sm bg-white/20 px-1.5 py-0.5 text-xs">
                      {retailer.price}
                    </span>
                  )}
                </AffiliateLink>
              ))}
            </div>

            {secondary.length > 0 && (
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                <span className="text-slate-500 dark:text-slate-400">Also stocked at: </span>
                {secondary.map((retailer, i) => (
                  <span key={retailer.name + retailer.url}>
                    {i > 0 && <span aria-hidden="true"> · </span>}
                    <AffiliateLink
                      href={retailer.url}
                      subId={subId}
                      className="font-medium text-brand-700 underline-offset-2 hover:underline dark:text-brand-400"
                    >
                      {retailer.name}
                    </AffiliateLink>
                  </span>
                ))}
              </p>
            )}
          </div>
        );
      })() : null}
    </div>
  );
}
