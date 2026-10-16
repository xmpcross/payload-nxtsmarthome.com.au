import Link from 'next/link';
import { articleHref } from '@/lib/urls';
import { squareCoverFor, formatDate, type Article } from '@/lib/content';
import { responsiveImg } from '@/lib/image'

/**
 * "Read Also" card dropped into the middle of an article's body.
 *
 * Placed mid-flow rather than at the end because that is where a reader's
 * attention dips — it is a genuine offer of somewhere better to go, not a
 * bottom-of-page afterthought.
 *
 * Two departures from the reference, for the same reason as elsewhere on this
 * site: it shows no comment count, because there are no comments to count, and it
 * carries no "AI-generated" edge tab, because these suggestions are computed from
 * the article's own category and tags.
 */
export default function ReadAlso({ items }: { items: Article[] }) {
  if (!items?.length) return null;

  return (
    <aside
      className="not-prose my-10 rounded-lg border border-slate-200 bg-white p-7 shadow-xs sm:p-8 dark:border-slate-700 dark:bg-slate-800/60"
      aria-labelledby="read-also-heading"
    >
      <p
        id="read-also-heading"
        className="text-xl font-bold text-slate-900 dark:text-white"
      >
        Read Also
      </p>

      <ul className="mt-5 flex flex-col gap-5">
        {items.map((article) => (
          <li key={article.slug} className="group flex items-center gap-4">
            <Link
              href={articleHref(article)}
              tabIndex={-1}
              aria-hidden="true"
              className="block w-18 shrink-0 overflow-hidden rounded-lg"
            >
              <img
                {...responsiveImg(squareCoverFor(article), 96, '72px')}
                alt={article.title}
                width={500}
                height={500}
                loading="lazy"
                className="aspect-square w-full object-cover transition duration-500 group-hover:scale-105"
              />
            </Link>

            <div className="min-w-0">
              <p className="text-[17px] font-bold leading-[24px] text-slate-900 dark:text-white">
                <Link
                  href={articleHref(article)}
                  className="hover:text-brand-700 dark:hover:text-brand-400"
                >
                  {article.title}
                </Link>
              </p>
              <p className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                <time dateTime={article.date}>
                  {formatDate(article.updated ?? article.date)}
                </time>
                <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                  •
                </span>
                <span>{article.readingMinutes} min read</span>
              </p>
            </div>
          </li>
        ))}
      </ul>
    </aside>
  );
}
