import Link from 'next/link';
import ArticleIndex, { type ArticleRow } from '@/components/articles/ArticleIndex';
import { FOCUS, shortDate, TYPE_ORDER, typeLabel } from '@/components/category/shared';
import JsonLd from '@/components/JsonLd';
import { articleHref, coverFor, type Article } from '@/lib/content';
import { breadcrumbJsonLd } from '@/lib/seo';
import { categories, site } from '@/lib/site';
import { responsiveImg } from '@/lib/image'

/** The lead story plus the next few beside it. */
const NEWEST = 6;

const MONTH = new Intl.DateTimeFormat('en-AU', { month: 'long', year: 'numeric', timeZone: 'UTC' });

/**
 * /articles/: the whole library on one page (redesigned 17 Oct 2026).
 *  - Lead: the newest guide large, with its description; the next three beside it as
 *    ruled rows with thumbnails.
 *  - Then every article in one list, newest first and grouped by month, which readers
 *    narrow by what they need (the article type, worded as a task), a topic and a title
 *    search (ArticleIndex). Nothing is paginated, so any guide is a search or a click away.
 */
export default function ArticlesList({ articles }: { articles: Article[] }) {
  const sorted = [...articles].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
  const newest = sorted.slice(0, NEWEST);
  const total = sorted.length;

  const rows: ArticleRow[] = sorted.map((a) => ({
    href: articleHref(a),
    title: a.title,
    topic: a.category,
    topicName: a.categoryMeta?.name ?? a.category,
    type: a.type,
    typeLabel: typeLabel(a.type),
    date: a.date,
    dateLabel: shortDate(a.date),
    monthKey: (a.date ?? '').slice(0, 7),
    monthLabel: a.date ? MONTH.format(new Date(a.date)) : 'Undated',
    minutes: a.readingMinutes,
    description: a.description ?? '',
    thumb: responsiveImg(coverFor(a), 112, '112px'),
  }));
  const [lead, ...beside] = newest;

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'All articles', path: '/articles/' },
        ])}
      />
      {total > 0 ? (
        <JsonLd
          data={{
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: 'All articles',
            url: `${site.url}/articles/`,
            inLanguage: site.language,
            mainEntity: {
              '@type': 'ItemList',
              itemListElement: rows.map((row, index) => ({
                '@type': 'ListItem',
                position: index + 1,
                url: `${site.url}${row.href}`,
                name: row.title,
              })),
            },
          }}
        />
      ) : null}

      <div className="page-articles">
        <header className="container pt-8 lg:pt-12">
          <nav
            aria-label="Breadcrumb"
            className="flex items-center gap-2 text-xs font-semibold text-neutral-600 dark:text-neutral-400"
          >
            <Link href="/" className={`hover:text-neutral-900 dark:hover:text-white ${FOCUS}`}>
              Home
            </Link>
            <span aria-hidden="true">/</span>
            <span className="text-neutral-900 dark:text-white" aria-current="page">
              All articles
            </span>
          </nav>
          <h1 className="mt-6 text-4xl font-black tracking-tight text-neutral-900 sm:text-5xl dark:text-white">
            All articles
          </h1>
          <p className="mt-5 max-w-[68ch] text-base leading-relaxed text-pretty text-neutral-700 sm:text-lg dark:text-neutral-300">
            Every buying guide, setup guide, comparison and explainer we have published, written for Australian homes.
            Search a title, or narrow the list by topic and type.
          </p>
          {total > 0 ? (
            <p className="mt-4 text-sm text-neutral-600 dark:text-neutral-400">
              <span className="font-semibold text-neutral-900 tabular-nums dark:text-white">{total}</span>{' '}
              {total === 1 ? 'guide' : 'guides'}, newest{' '}
              <time dateTime={sorted[0].date} className="tabular-nums">{shortDate(sorted[0].date)}</time>. Prefer to browse by subject?{' '}
              <Link
                href="/all-topics/"
                className={`font-semibold text-primary-600 underline underline-offset-4 dark:text-primary-400 ${FOCUS}`}
              >
                See all topics
              </Link>
            </p>
          ) : null}
        </header>

        <div className="container pt-10 pb-20 lg:pt-12 lg:pb-28">
          {total === 0 ? (
            <p className="text-neutral-700 dark:text-neutral-300">No articles published yet.</p>
          ) : (
            <>
              <section aria-labelledby="newest-heading">
                <h2 id="newest-heading" className="sr-only">
                  Newest guides
                </h2>
                <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
                  {/* Lead: the newest guide, large, with its description. */}
                  <Link href={articleHref(lead)} className={`group block lg:col-span-7 ${FOCUS}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      {...responsiveImg(coverFor(lead), 880, '(max-width: 1024px) 100vw, 58vw')}
                      alt=""
                      width={880}
                      height={550}
                      loading="eager"
                      fetchPriority="high"
                      className="aspect-[16/10] w-full rounded-lg object-cover"
                    />
                    <span className="mt-4 block text-sm text-neutral-600 dark:text-neutral-400">
                      <time dateTime={lead.date} className="font-semibold text-primary-600 tabular-nums dark:text-primary-400">
                        {shortDate(lead.date)}
                      </time>{' '}
                      · {lead.categoryMeta?.name ?? lead.category} · <span className="tabular-nums">{lead.readingMinutes} min read</span>
                    </span>
                    <span className="mt-2 block text-2xl leading-tight font-bold tracking-tight text-pretty text-neutral-900 group-hover:underline group-hover:underline-offset-4 sm:text-[1.75rem] dark:text-white">
                      {lead.title}
                    </span>
                    {lead.description ? (
                      <span className="mt-3 block max-w-[68ch] text-base leading-relaxed text-neutral-700 dark:text-neutral-300">
                        {lead.description}
                      </span>
                    ) : null}
                  </Link>

                  {/* The next newest, as ruled rows beside the lead. */}
                  {beside.length ? (
                    <div className="lg:col-span-5">
                      <p className="border-b border-neutral-900 pb-2 text-base font-bold text-neutral-900 dark:border-white dark:text-white">
                        Also new
                      </p>
                      <ul>
                        {beside.map((article, i) => (
                          // Five beside the lead on wide screens fill its height; three on narrower ones.
                          <li key={article.slug} className={`border-b border-neutral-200 dark:border-neutral-800 ${i >= 3 ? 'hidden lg:block' : ''}`}>
                            <Link href={articleHref(article)} className={`group flex items-start gap-4 py-4 ${FOCUS}`}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                {...responsiveImg(coverFor(article), 112, '112px')}
                                alt=""
                                width={112}
                                height={84}
                                loading="lazy"
                                className="aspect-[4/3] w-24 shrink-0 rounded-lg object-cover sm:w-28"
                              />
                              <span className="min-w-0">
                                <span className="block text-[1.0625rem] leading-snug font-bold text-neutral-900 group-hover:text-primary-600 dark:text-white dark:group-hover:text-primary-400">
                                  {article.title}
                                </span>
                                <span className="mt-1.5 block text-sm text-neutral-600 dark:text-neutral-400">
                                  <time dateTime={article.date} className="tabular-nums">{shortDate(article.date)}</time> ·{' '}
                                  {article.categoryMeta?.name ?? article.category}
                                </span>
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              </section>

              <section aria-label="Every guide" className="mt-20 lg:mt-24">
                <ArticleIndex
                  rows={rows}
                  topics={categories.map((c) => ({ key: c.key, name: c.name }))}
                  types={TYPE_ORDER}
                />
              </section>
            </>
          )}
        </div>
      </div>
    </>
  );
}
