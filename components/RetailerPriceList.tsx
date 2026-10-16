import AffiliateLink from './AffiliateLink';
import type { TopProductRetailer } from '@/lib/products';
import { retailerLogoIsDark, retailerLogoSrc } from '@/lib/retailer-logos';

/**
 * Compact retailer price list for the product page's right column.
 *
 * Only retailers with a verified price are listed, cheapest first. A stockist
 * we could not price adds a row without adding information here, so those are
 * left to the full "Where to Buy" table further down the page, which still
 * lists every retailer.
 */

/** Brand colours for the fallback initial tile, so rows stay distinguishable. */
const TILE_COLOURS: Array<{ match: string; bg: string; fg: string }> = [
  { match: 'jb hi-fi', bg: '#ffe500', fg: '#111827' },
  { match: 'good guys', bg: '#002d62', fg: '#ffffff' },
  { match: 'harvey norman', bg: '#0a2540', fg: '#ffffff' },
  { match: 'officeworks', bg: '#0f766e', fg: '#ffffff' },
  { match: 'bunnings', bg: '#0d5257', fg: '#ffffff' },
  { match: 'bing lee', bg: '#be123c', fg: '#ffffff' },
  { match: 'kogan', bg: '#111827', fg: '#34d399' },
  { match: 'scorptec', bg: '#1f2937', fg: '#f59e0b' },
  { match: 'mwave', bg: '#0f172a', fg: '#38bdf8' },
];

/**
 * The mark is the only thing identifying the retailer now that the name column
 * is gone, so it carries the accessible name — and retailers without a logo
 * file fall back to their name set small rather than a bare initial, which
 * would leave "The Good Guys" and "Harvey Norman" indistinguishable.
 */
function RetailerMark({ name }: { name: string }) {
  const lower = name.toLowerCase();
  const src = retailerLogoSrc(name);

  // White backing in both themes: the marks are drawn for a light background,
  // and several (Amazon, Kogan, The Good Guys) vanish on the dark row.
  if (src) {
    return (
      <span
        className={`flex h-9 w-20 shrink-0 items-center justify-center rounded-md p-1 ring-1 ring-black/5 ${
          retailerLogoIsDark(name) ? 'bg-[#111]' : 'bg-white'
        }`}
      >
        <img
          src={src}
          alt={name}
          width={72}
          height={28}
          loading="lazy"
          className="h-full w-full object-contain"
        />
      </span>
    );
  }

  const tile = TILE_COLOURS.find((t) => lower.includes(t.match));
  return (
    <span
      className="flex h-9 w-20 shrink-0 items-center justify-center rounded-md px-1.5 text-center text-[0.625rem] font-bold leading-tight"
      style={{ background: tile?.bg || '#e2e8f0', color: tile?.fg || '#334155' }}
    >
      {name}
    </span>
  );
}

export default function RetailerPriceList({
  retailers,
  subId,
  pricesCheckedAt,
}: {
  retailers: TopProductRetailer[];
  subId: string;
  pricesCheckedAt?: string;
}) {
  if (!retailers?.length) return null;

  const ordered = retailers
    .filter((r) => typeof r.priceAud === 'number' && r.priceAud > 0)
    .sort((a, b) => (a.priceAud || 0) - (b.priceAud || 0));

  if (!ordered.length) return null;

  const updated = pricesCheckedAt
    ? new Date(pricesCheckedAt).toLocaleString('en-AU', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : null;

  return (
    <div>
      <ul className="space-y-1.5">
        {ordered.map((retailer, idx) => (
          <li
            key={`${retailer.name}-${idx}`}
            className="flex items-center gap-2.5 rounded-lg bg-[#f5f6f8] px-2.5 py-2 dark:bg-slate-900/60"
          >
            <RetailerMark name={retailer.name} />

            <span className="flex-1 text-right text-sm font-bold text-[#1d252c] dark:text-white">
              ${retailer.priceAud!.toLocaleString('en-AU', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>

            <AffiliateLink
              href={retailer.url}
              subId={subId}
              className="inline-flex min-h-11 shrink-0 items-center rounded-md bg-primary-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-primary-700 dark:bg-primary-600 dark:hover:bg-primary-500"
            >
              View
            </AffiliateLink>
          </li>
        ))}
      </ul>

      {updated ? (
        <p className="mt-2.5 text-[0.6875rem] text-[#8a8a8f] dark:text-slate-400">
          Last price update was: {updated}
        </p>
      ) : (
        <p className="mt-2.5 text-[0.6875rem] text-[#8a8a8f] dark:text-slate-400">
          Prices are checked at the retailer — confirm before buying.
        </p>
      )}
    </div>
  );
}
