/**
 * Five stars for a product card. With reviews: whole stars filled for the average rating
 * (rounded, as the reviews block does), plus the average and review count as text. With none:
 * five outline stars and no number, so a product without reviews is not given a score.
 * No imports and no state: usable from server and client components.
 */
const STAR = 'M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3 6.1 20.6l1.3-6.6L2.5 9.4l6.6-.8z';

export default function StarRating({ rating, count }: { rating: number | null; count: number }) {
  const has = rating !== null && count > 0;
  const filled = has ? Math.max(0, Math.min(5, Math.round(rating))) : 0;
  const label = has ? `Rated ${rating.toFixed(1)} out of 5 from ${count} review${count === 1 ? '' : 's'}` : 'No reviews yet';
  return (
    <span className="flex items-center gap-1.5" role="img" aria-label={label}>
      <span className="flex items-center gap-px" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((n) => (
          <svg key={n} viewBox="0 0 24 24" width="15" height="15" className={n <= filled ? 'text-[#ffc800]' : 'text-neutral-400 dark:text-neutral-500'}>
            <path d={STAR} fill={n <= filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={n <= filled ? 1 : 1.6} strokeLinejoin="round" />
          </svg>
        ))}
      </span>
      {has ? (
        <span className="text-[12px] text-neutral-600 tabular-nums dark:text-neutral-400" aria-hidden="true">
          {rating.toFixed(1)} ({count})
        </span>
      ) : null}
    </span>
  );
}
