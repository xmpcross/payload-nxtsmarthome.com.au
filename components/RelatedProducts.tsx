import Link from 'next/link';
import type { TopProduct } from '@/lib/products';
import { responsiveImg } from '@/lib/image'

/**
 * Related products strip for the bottom of a product page.
 *
 * Six per row on desktop, stepping down to two on the narrowest screens — at
 * 1/6 of the content width a card is roughly 200px, so the compact card here
 * is deliberately lighter than ProductCard (no verdict, no retailer row).
 */
export default function RelatedProducts({ products }: { products: TopProduct[] }) {
  if (!products.length) return null;

  return (
    <section className="mt-5 rounded-[8px] bg-white p-5 dark:bg-slate-800 sm:p-6">
      <h2 className="mb-4 text-2xl font-bold text-[#1d252c] dark:text-white">Related Products</h2>

      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {products.map((product) => (
          <li key={product.slug}>
            <Link
              href={`/products/${product.slug}/`}
              className="group flex h-full flex-col rounded-[8px] border border-[#e0e0e0] p-3 transition hover:border-[#0046be] dark:border-slate-700 dark:hover:border-blue-500"
            >
              <div className="mb-2.5 flex h-28 items-center justify-center overflow-hidden rounded-[8px] bg-slate-50 p-2 dark:bg-[#ffffff]">
                <img
                  {...responsiveImg(product.image || '/og-default.png', 384, '(max-width: 640px) 50vw, 16rem')}
                  alt={product.brand ? `${product.brand} ${product.name}` : product.name}
                  width={256}
                  height={256}
                  loading="lazy"
                  className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
                />
              </div>

              {product.brand ? (
                <span className="text-[0.6875rem] font-semibold text-[#0046be] dark:text-blue-400">
                  {product.brand}
                </span>
              ) : null}

              <h3 className="mt-0.5 line-clamp-2 text-xs font-bold leading-snug text-[#1d252c] group-hover:text-[#0046be] dark:text-white dark:group-hover:text-blue-400">
                {product.name}
              </h3>

              <div className="mt-auto pt-2">
                {/* No star rating (it reads as our score) and no seeded
                    priceAud (never a real price): the lowest verified one. */}
                {(() => {
                  const prices = (product.retailers || [])
                    .map((r) => r.priceAud)
                    .filter((p): p is number => typeof p === 'number' && p > 0);
                  return prices.length ? (
                    <div className="mt-1 text-sm font-bold text-[#1d252c] dark:text-white">
                      from ${Math.min(...prices).toLocaleString('en-AU')}
                    </div>
                  ) : null;
                })()}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
