'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { responsiveImg } from '@/lib/image';

/**
 * /products/ browser (redesign approved 17 Oct 2026): category chips, a sticky
 * search / retailer / price / sort bar and a dense card grid, 24 at a time.
 *
 * Receives slim rows built on the server, not whole catalogue products: the
 * full records (reviews, specs, descriptions) once shipped 2.4 MB of props to
 * this page. The first 24 cards are server-rendered, so the page has real
 * content without JavaScript; every product is also linked from its category
 * page and the sitemap.
 */

export type BrowserProduct = {
  slug: string;
  name: string;
  brand?: string;
  category: string;
  categorySlug: string;
  image?: string;
  bestFor?: string;
  low: number | null;
  lowAt: string | null;
  retailers: string[];
  guide: string | null;
};

export type BrowserCategory = { slug: string; name: string; count: number; icon: string };

const PAGE = 24;
const PRICES = [
  { value: '50', label: 'Under $50' },
  { value: '100', label: 'Under $100' },
  { value: '250', label: 'Under $250' },
  { value: '500', label: 'Under $500' },
  { value: '1000', label: 'Under $1,000' },
];
type Sort = 'guides' | 'price' | 'price-desc' | 'retailers' | 'name';

const field =
  'min-h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-[15px] text-neutral-900 dark:border-[#313131] dark:bg-[#222324] dark:text-white';
const money = (v: number) => (v % 1 ? v.toFixed(2) : v.toLocaleString('en-AU'));

export default function ProductBrowser({
  products,
  categories,
  retailers,
}: {
  products: BrowserProduct[];
  categories: BrowserCategory[];
  retailers: string[];
}) {
  const [cat, setCat] = useState('');
  const [q, setQ] = useState('');
  const [retailer, setRetailer] = useState('');
  const [price, setPrice] = useState('');
  const [sort, setSort] = useState<Sort>('guides');
  const [guidesOnly, setGuidesOnly] = useState(false);
  const [shown, setShown] = useState(PAGE);
  const guideCount = products.filter((p) => p.guide).length;

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const out = products.filter(
      (p) =>
        (!cat || p.categorySlug === cat) &&
        (!retailer || p.retailers.includes(retailer)) &&
        (!price || (p.low != null && p.low < Number(price))) &&
        (!guidesOnly || p.guide) &&
        (!needle || `${p.name} ${p.brand ?? ''} ${p.category} ${p.bestFor ?? ''}`.toLowerCase().includes(needle)),
    );
    const by: Record<Sort, (a: BrowserProduct, b: BrowserProduct) => number> = {
      guides: (a, b) => Number(Boolean(b.guide)) - Number(Boolean(a.guide)) || a.name.localeCompare(b.name),
      price: (a, b) => (a.low ?? Infinity) - (b.low ?? Infinity),
      'price-desc': (a, b) => (b.low ?? -1) - (a.low ?? -1),
      retailers: (a, b) => b.retailers.length - a.retailers.length || (a.low ?? Infinity) - (b.low ?? Infinity),
      name: (a, b) => a.name.localeCompare(b.name),
    };
    return out.sort(by[sort]);
  }, [products, cat, q, retailer, price, sort, guidesOnly]);

  const visible = list.slice(0, shown);
  const reset = () => setShown(PAGE);

  return (
    <div>
      {/* Category chips */}
      <div role="group" aria-label="Category" className="flex gap-2 overflow-x-auto pt-5 pb-1">
        {[{ slug: '', name: 'All', count: products.length, icon: '' }, ...categories].map((c) => (
          <button
            key={c.slug || 'all'}
            type="button"
            aria-pressed={cat === c.slug}
            onClick={() => {
              setCat(c.slug);
              reset();
            }}
            className={`inline-flex min-h-12 flex-none items-center gap-2 rounded-lg border py-1.5 pr-3.5 text-sm font-medium transition-colors ${
              c.icon ? 'pl-2' : 'pl-3.5'
            } ${
              cat === c.slug
                ? 'border-primary-600 bg-primary-50 text-neutral-900 dark:border-primary-400 dark:bg-primary-500/10 dark:text-white'
                : 'border-neutral-200 bg-white text-neutral-700 hover:border-primary-600 dark:border-[#313131] dark:bg-[#222324] dark:text-neutral-300 dark:hover:border-primary-400'
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {c.icon ? <img src={c.icon} alt="" width={32} height={32} className="size-8" /> : null}
            {c.name}
            <span className="text-neutral-500 tabular-nums dark:text-neutral-400">{c.count}</span>
          </button>
        ))}
      </div>

      {/* Filter bar */}
      <div className="sticky top-0 z-20 mt-3 border-b border-neutral-200 bg-white py-3 dark:border-neutral-800 dark:bg-[rgb(17,24,39)]">
        <div className="grid gap-2.5 lg:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))_auto] lg:items-end">
          <label className="flex min-w-0 flex-col gap-1">
            <span className="text-xs text-neutral-600 dark:text-neutral-400">Search</span>
            <input
              type="search"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                reset();
              }}
              placeholder="Brand, model or type, e.g. Tapo, doorbell"
              autoComplete="off"
              className={field}
            />
          </label>
          <label className="flex min-w-0 flex-col gap-1">
            <span className="text-xs text-neutral-600 dark:text-neutral-400">Sold at</span>
            <select value={retailer} onChange={(e) => { setRetailer(e.target.value); reset(); }} className={field}>
              <option value="">Any retailer</option>
              {retailers.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </label>
          <label className="flex min-w-0 flex-col gap-1">
            <span className="text-xs text-neutral-600 dark:text-neutral-400">Price</span>
            <select value={price} onChange={(e) => { setPrice(e.target.value); reset(); }} className={field}>
              <option value="">Any price</option>
              {PRICES.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </label>
          <label className="flex min-w-0 flex-col gap-1">
            <span className="text-xs text-neutral-600 dark:text-neutral-400">Sort by</span>
            <select value={sort} onChange={(e) => { setSort(e.target.value as Sort); reset(); }} className={field}>
              <option value="guides">In our guides first</option>
              <option value="price">Lowest price</option>
              <option value="price-desc">Highest price</option>
              <option value="retailers">Most retailers</option>
              <option value="name">Name A to Z</option>
            </select>
          </label>
          <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm whitespace-nowrap text-neutral-700 dark:text-neutral-300">
            <input
              type="checkbox"
              checked={guidesOnly}
              onChange={(e) => { setGuidesOnly(e.target.checked); reset(); }}
              className="size-[18px] accent-primary-600"
            />
            In our guides ({guideCount})
          </label>
        </div>
      </div>

      <p aria-live="polite" className="pt-4 pb-3 text-sm text-neutral-600 tabular-nums dark:text-neutral-400">
        {list.length ? `Showing ${visible.length} of ${list.length} devices` : ''}
      </p>

      {visible.length ? (
        <div className="grid grid-cols-2 gap-3.5 md:grid-cols-3 xl:grid-cols-4">
          {visible.map((p) => (
            <Link
              key={p.slug}
              href={`/products/${p.slug}/`}
              className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-neutral-200 bg-white transition-colors hover:border-primary-600 dark:border-[#313131] dark:bg-[#222324] dark:hover:border-primary-400"
            >
              <span className="relative block aspect-[4/3] bg-white">
                {p.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    {...responsiveImg(p.image, 256, '(min-width: 1280px) 22vw, (min-width: 768px) 30vw, 46vw')}
                    alt={p.name}
                    width={256}
                    height={192}
                    loading="lazy"
                    className="absolute inset-3.5 h-[calc(100%-1.75rem)] w-[calc(100%-1.75rem)] object-contain"
                  />
                ) : null}
                {p.guide ? (
                  <span className="absolute top-2 left-2 rounded bg-primary-600 px-2 py-0.5 text-[11px] font-semibold text-white">
                    In our guides
                  </span>
                ) : null}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-1.5 px-3.5 pt-3 pb-3.5">
                <span className="truncate text-xs text-neutral-600 dark:text-neutral-400">
                  {p.brand ? `${p.brand} · ` : ''}
                  {p.category}
                </span>
                <span className="line-clamp-2 text-[15px] leading-snug font-bold text-neutral-900 dark:text-white">{p.name}</span>
                {p.bestFor ? (
                  <span className="line-clamp-2 text-[13px] leading-snug text-neutral-600 dark:text-neutral-400">Suits: {p.bestFor}</span>
                ) : null}
                {p.guide ? (
                  <span className="line-clamp-1 text-xs text-primary-600 dark:text-primary-400">Covered in: {p.guide}</span>
                ) : null}
                <span className="mt-auto flex items-end justify-between gap-2 border-t border-neutral-200 pt-2.5 text-xs text-neutral-600 dark:border-neutral-800 dark:text-neutral-400">
                  {p.low != null ? (
                    <span>
                      From
                      <b className="block text-lg text-neutral-900 tabular-nums dark:text-white">${money(p.low)}</b>
                      at {p.lowAt}
                    </span>
                  ) : (
                    <span>Check price at the retailer</span>
                  )}
                  <span className="text-right whitespace-nowrap tabular-nums">
                    {p.retailers.length === 1 ? '1 retailer' : `${p.retailers.length} retailers`}
                  </span>
                </span>
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-neutral-300 px-4 py-10 text-center text-neutral-600 dark:border-[#313131] dark:text-neutral-400">
          No devices match these filters. Try another category or clear the search.
        </p>
      )}

      {visible.length < list.length ? (
        <div className="flex justify-center pt-7">
          <button
            type="button"
            onClick={() => setShown((n) => n + PAGE)}
            className="inline-flex min-h-12 items-center rounded-lg border border-neutral-300 bg-white px-5 font-semibold text-neutral-900 transition-colors hover:border-primary-600 dark:border-[#313131] dark:bg-[#222324] dark:text-white dark:hover:border-primary-400"
          >
            Show {Math.min(PAGE, list.length - visible.length)} more
          </button>
        </div>
      ) : null}
    </div>
  );
}
