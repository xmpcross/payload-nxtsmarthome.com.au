'use client';

import { useMemo, useState } from 'react';
import AffiliateLink from './AffiliateLink';
import type { ProductReview, TopProduct } from '@/lib/products';
import { joinNames, MIN_AGGREGATE_REVIEWS, retailerReviews } from '@/lib/review-sources';

/**
 * Customer reviews, laid out like the reference PDP: aggregate score, star
 * histogram and review themes across the top, then a grid of review cards and
 * a call to action.
 *
 * Reviews from every source are shown (lib/review-sources.ts, changed 17 Oct 2026),
 * each labelled with where it was posted: Australian retailers, the brand's own
 * AU site and the brand's global store first, then other sources by domain. The block says whose they are and that we did not write
 * them. No "Verified purchase" badge: these are syndicated, and we cannot
 * verify that anyone bought anything. Under MIN_VISIBLE_REVIEWS allowed
 * reviews the block does not render at all.
 *
 * Every figure is counted from the reviews shown — the score, the histogram
 * and the "4 stars or higher" share — and none of them appear below
 * MIN_AGGREGATE_REVIEWS reviews. With no AU retailer reviews the block does
 * not render at all.
 *
 * Blocks the data cannot support stay hidden rather than being invented. In
 * particular the reference's "Customers are saying" AI summary, its sentiment
 * topic chips and its Customer Images strip have no source in this dataset —
 * no review carries an image, and no keyword or summary data is returned — so
 * they do not render. Fabricating them would mean attributing opinions and
 * photos to customers who never supplied them.
 */

const REVIEW_CLAMP = 220;
/* Cards in the scrolling row before "See all" opens the full grid. */
const ROW_CARDS = 8;

/* Filled gold stars, as the reference layout draws them. */
function Stars({ rating, size = 'text-lg' }: { rating: number; size?: string }) {
  const filled = Math.round(rating);
  return (
    <span className={`${size} leading-none tracking-[0.02em]`} aria-label={`${rating} out of 5 stars`}>
      <span className="text-[#ffc800]">{'★'.repeat(filled)}</span>
      <span className="text-slate-300 dark:text-slate-600">{'★'.repeat(Math.max(0, 5 - filled))}</span>
    </span>
  );
}

function ReviewCard({ review, inRow }: { review: ProductReview & { retailer: string }; inRow: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = review.body.length > REVIEW_CLAMP;
  const body = expanded || !isLong ? review.body : `${review.body.slice(0, REVIEW_CLAMP).trimEnd()} ...`;

  return (
    <article
      className={`flex flex-col rounded-[8px] border border-[#d5d8dc] bg-white p-4 dark:border-slate-700 dark:bg-slate-800 ${
        inRow ? 'w-[280px] shrink-0 snap-start sm:w-[300px]' : ''
      }`}
    >
      <Stars rating={review.rating} />

      {review.title ? (
        <h3 className="mt-2.5 text-base font-bold leading-snug text-[#1d252c] dark:text-white">{review.title}</h3>
      ) : null}

      <ul className="mt-2 flex flex-wrap gap-1.5">
        <li className="rounded-sm border border-[#c5cbd5] px-1.5 py-px text-[0.6875rem] text-[#55555a] dark:border-slate-600 dark:text-slate-400">
          via {review.retailer}
        </li>
      </ul>

      <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-[#1d252c] dark:text-slate-300">{body}</p>

      {isLong ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 self-start text-sm text-[#0046be] hover:underline dark:text-blue-400"
        >
          {expanded ? 'See less' : 'See more'}
        </button>
      ) : null}

      <p className="mt-auto pt-4 text-[0.6875rem] text-[#55555a] dark:text-slate-400">
        This review is from {review.retailer}
        {review.postedAt || review.author ? <br /> : null}
        {review.postedAt ? `Posted ${review.postedAt}` : ''}
        {review.author ? `${review.postedAt ? ' ' : ''}by ${review.author}` : ''}
      </p>
    </article>
  );
}

export default function ProductReviews({ product }: { product: TopProduct }) {
  const [showAll, setShowAll] = useState(false);
  const { reviews, retailers, aggregate } = useMemo(
    () => retailerReviews(product),
    [product],
  );

  // Counted from the imported reviews themselves, so the bars always add up to
  // the reviews actually shown on the page.
  const stats = useMemo(() => {
    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let rated = 0;
    for (const r of reviews) {
      const star = Math.round(r.rating);
      if (star >= 1 && star <= 5) {
        counts[star] += 1;
        rated += 1;
      }
    }
    const positive = counts[4] + counts[5];
    return {
      counts,
      rated,
      positivePct: rated ? Math.round((positive / rated) * 100) : null,
    };
  }, [reviews]);

  if (!reviews.length) return null;

  const rating = aggregate?.rating;
  const reviewCount = aggregate?.count;
  // Many sources would make the heading a paragraph: name the first two and count the rest.
  const from = retailers.length <= 3 ? joinNames(retailers) : `${joinNames(retailers.slice(0, 2))} and ${retailers.length - 2} other sources`;

  const primaryRetailer = product.retailers?.find((r) => r.primary) || product.retailers?.[0];
  const readMoreHref = product.reviewsUrl || primaryRetailer?.url;
  const perRetailer = retailers.map((name) => ({ name, count: reviews.filter((r) => r.retailer === name).length }));

  return (
    <section className="rounded-[8px] bg-white p-5 dark:bg-slate-800 sm:p-6">
      <h2 className="text-2xl font-bold text-[#1d252c] dark:text-white">What customers say at {from}</h2>
      <p className="mt-1 text-sm text-[#55555a] dark:text-slate-400">
        Reviews written by customers of the stores named on each review — not by NXT Smart Home, and not a test result.
      </p>

      {/*
        Laid out like the reference PDP: score and histogram on the left, the
        "Customers are saying" column on the right, a divider, then a scrolling
        row of review cards and a "See all" button. Only what the data supports
        is filled in: no AI summary or sentiment themes (none exist for these
        reviews), no customer photos (none were imported), no "Verified
        Purchaser" badges (we cannot verify them), and no score under
        MIN_AGGREGATE_REVIEWS. The chips under "About these reviews" are the
        real review count per retailer.
      */}
      <div className="mt-4 grid gap-8 border-b border-[#e0e0e0] pb-6 dark:border-slate-700 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]">
        {/* Score + histogram */}
        <div>
          {rating ? (
            <div className="flex items-start gap-6">
              <div className="shrink-0 text-center">
                <div className="flex items-center gap-1.5">
                  <span className="text-3xl leading-none text-[#ffc800]" aria-hidden="true">★</span>
                  <span className="text-[2.5rem] font-bold leading-none text-[#1d252c] dark:text-white">
                    {rating.toFixed(1)}
                  </span>
                </div>
                <p className="mt-2 text-sm text-[#55555a] dark:text-slate-400">
                  {reviewCount?.toLocaleString('en-AU')} review{reviewCount === 1 ? '' : 's'}
                </p>
              </div>

              <div className="min-w-0 flex-1 space-y-1">
                {[5, 4, 3, 2, 1].map((star) => {
                  const count = stats.counts[star];
                  const pct = stats.rated ? (count / stats.rated) * 100 : 0;
                  return (
                    <div key={star} className="flex items-center gap-2 text-xs">
                      <span className="w-3 shrink-0 text-right text-[#1d252c] dark:text-slate-300">{star}</span>
                      <span className="shrink-0 text-[#ffc800]" aria-hidden="true">★</span>
                      <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-[#d5d5d5] dark:bg-slate-600">
                        <span className="block h-full rounded-full bg-[#0046be] dark:bg-blue-500" style={{ width: `${pct}%` }} />
                      </span>
                      <span className="w-7 shrink-0 text-right text-[#55555a] dark:text-slate-400">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div>
              <p className="text-[2.5rem] font-bold leading-none text-[#1d252c] dark:text-white">{reviews.length}</p>
              <p className="mt-2 text-sm text-[#55555a] dark:text-slate-400">
                customer review{reviews.length === 1 ? '' : 's'} from {from}
              </p>
              <p className="mt-3 text-xs text-[#8a8a8f] dark:text-slate-500">
                No overall score is shown under {MIN_AGGREGATE_REVIEWS} reviews.
              </p>
            </div>
          )}

          {rating && stats.positivePct !== null && stats.rated >= MIN_AGGREGATE_REVIEWS ? (
            /* Not "would recommend to a friend": that is a survey question this
               data does not answer. This is the share rated 4 stars or higher. */
            <p className="mt-5 text-center text-sm text-[#1d252c] dark:text-slate-200">
              <span className="text-[#1d252c] dark:text-slate-200" aria-hidden="true">✓ </span>
              <strong className="font-bold">{stats.positivePct}%</strong> rated this 4 stars or higher
            </p>
          ) : null}
        </div>

        {/* The reference's "Customers are saying" column */}
        <div>
          <h3 className="text-base font-bold text-[#1d252c] dark:text-white">About these reviews</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-[#1d252c] dark:text-slate-300">
            Customer reviews syndicated from {from}. We do not edit them, and we cannot confirm the
            reviewers bought the product. They come from retailers in Australia and overseas, and
            each review says where it was posted; Australian sources are listed first and overseas
            ones may not reflect Australian stock, pricing or warranty.
          </p>
          <p className="mt-2 text-[0.6875rem] text-[#55555a] dark:text-slate-400">
            Reviews may relate to a different variant, bundle or colour. Check the retailer&apos;s page
            for the exact item before buying.
          </p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {perRetailer.slice(0, 8).map(({ name, count }) => (
              <li
                key={name}
                className="inline-flex items-center gap-1.5 rounded-md bg-[#e8f6ec] px-3 py-1.5 text-sm text-[#1d252c] dark:bg-emerald-500/15 dark:text-emerald-100"
              >
                <span className="flex size-4 items-center justify-center rounded-full bg-[#318000] text-[10px] text-white" aria-hidden="true">
                  ✓
                </span>
                {name} ({count})
              </li>
            ))}
            {perRetailer.length > 8 ? (
              <li className="inline-flex items-center rounded-md bg-neutral-100 px-3 py-1.5 text-sm text-[#55555a] dark:bg-slate-700 dark:text-slate-200">
                +{perRetailer.length - 8} more sources
              </li>
            ) : null}
          </ul>
        </div>
      </div>

      {/* Review cards: a scrolling row, or the full grid after "See all". */}
      {showAll ? (
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {reviews.map((review) => (
            <ReviewCard key={review.id} review={review} inRow={false} />
          ))}
        </div>
      ) : (
        <div className="-mx-1 mt-6 flex snap-x gap-4 overflow-x-auto px-1 pb-3">
          {reviews.slice(0, ROW_CARDS).map((review) => (
            <ReviewCard key={review.id} review={review} inRow />
          ))}
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-4">
        {reviews.length > 1 ? (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="rounded-md bg-[#0046be] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#003a9e]"
          >
            {showAll ? 'Show fewer reviews' : 'See all customer reviews'}
          </button>
        ) : null}

        {readMoreHref && primaryRetailer ? (
          <AffiliateLink
            href={readMoreHref}
            subId={`reviews-cta-${product.slug}`}
            className="text-sm font-semibold text-[#0046be] hover:underline dark:text-blue-400"
          >
            Read more at {primaryRetailer.name} →
          </AffiliateLink>
        ) : null}
      </div>
    </section>
  );
}
