import type { TopProductRetailer } from '@/lib/products';

interface Props {
  productName: string;
  retailers: TopProductRetailer[];
}

const DAYS = 30;
const DAY_MS = 86_400_000;
const aud = (n: number) => `$${n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const sydneyDay = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' });
const dayLabel = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', timeZone: 'UTC' });

/**
 * Lowest recorded price across retailers for each of the last 30 days. A retailer's price carries
 * forward until its next check, and a day is plotted only once at least one price is on record.
 */
function lowestSeries(retailers: TopProductRetailer[]) {
  const today = new Date(`${sydneyDay(new Date())}T00:00:00Z`).getTime();
  const histories = retailers.map((r) => (r.history ?? []).filter((x) => x && typeof x.p === 'number'));
  const series: { d: string; p: number }[] = [];
  for (let i = DAYS - 1; i >= 0; i--) {
    const d = new Date(today - i * DAY_MS).toISOString().slice(0, 10);
    const prices = histories
      .map((h) => [...h].reverse().find((x) => x.d <= d)?.p)
      .filter((p): p is number => typeof p === 'number');
    if (prices.length) series.push({ d, p: Math.min(...prices) });
  }
  return series;
}

export default function PriceHistory({ productName, retailers }: Props) {
  const series = lowestSeries(retailers);
  const hasChart = series.length >= 2;
  const first = series[0];
  const last = series[series.length - 1];

  const W = 640, H = 200, PX = 12, PT = 16, PB = 22;
  const prices = series.map((s) => s.p);
  const lo = Math.min(...prices), hi = Math.max(...prices);
  const pad = hi === lo ? Math.max(hi * 0.05, 1) : (hi - lo) * 0.15;
  const yMin = lo - pad, yMax = hi + pad;
  const x = (i: number) => PX + (i * (W - PX * 2)) / (series.length - 1);
  const y = (p: number) => PT + ((yMax - p) * (H - PT - PB)) / (yMax - yMin);
  const line = series.map((s, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(s.p).toFixed(1)}`).join(' ');
  const area = `${line} L${x(series.length - 1).toFixed(1)} ${H - PB} L${x(0).toFixed(1)} ${H - PB} Z`;
  const change = hasChart ? last.p - first.p : 0;

  return (
    <section
      aria-labelledby="price-history-heading"
      className="not-prose my-6 overflow-hidden rounded-[8px] border border-slate-200 bg-white shadow-xs dark:border-slate-700 dark:bg-slate-800"
    >
      <div className="border-b border-slate-100 bg-slate-50 px-5 py-4 dark:border-slate-700 dark:bg-slate-800/80">
        <h3 id="price-history-heading" className="text-base font-bold text-slate-900 dark:text-white">
          Price history: {productName}
        </h3>
        <p className="text-xs text-slate-600 dark:text-slate-400">
          Lowest price we recorded across Australian retailers, last 30 days.
        </p>
      </div>

      {hasChart ? (
        <div className="px-5 py-4">
          <dl className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ['Now', aud(last.p)],
              ['30-day low', aud(lo)],
              ['30-day high', aud(hi)],
              ['Change', change === 0 ? 'No change' : `${change < 0 ? '−' : '+'}${aud(Math.abs(change))}`],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-[0.6875rem] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{k}</dt>
                <dd className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">{v}</dd>
              </div>
            ))}
          </dl>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            role="img"
            aria-label={`Lowest price of ${productName} from ${dayLabel(first.d)} to ${dayLabel(last.d)}: ${aud(first.p)} to ${aud(last.p)}, low ${aud(lo)}, high ${aud(hi)}.`}
            className="h-auto w-full text-brand-600 dark:text-brand-400"
          >
            <path d={area} fill="currentColor" opacity="0.1" />
            <path d={line} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            <circle cx={x(series.length - 1)} cy={y(last.p)} r="4" fill="currentColor" />
            <text x={PX} y={H - 6} fontSize="11" className="fill-slate-500 dark:fill-slate-400">{dayLabel(first.d)}</text>
            <text x={W - PX} y={H - 6} fontSize="11" textAnchor="end" className="fill-slate-500 dark:fill-slate-400">{dayLabel(last.d)}</text>
          </svg>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            {series.length < DAYS
              ? `We began recording on ${dayLabel(first.d)}, so this shows ${series.length} days so far. `
              : ''}
            Prices are checked on retailer pages and can change at any time; confirm on the retailer&apos;s site.
          </p>
        </div>
      ) : (
        <p className="px-5 py-4 text-sm text-slate-600 dark:text-slate-300">
          We record Australian retailer prices daily. A chart appears here once we have two days of prices for this product.
        </p>
      )}
    </section>
  );
}
