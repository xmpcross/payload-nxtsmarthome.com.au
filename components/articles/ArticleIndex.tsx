'use client'

import Link from 'next/link'
import { useId, useState } from 'react'

export interface ArticleRow {
  href: string
  title: string
  description: string
  topic: string
  topicName: string
  type: string
  typeLabel: string
  date: string
  dateLabel: string
  /** "2026-10": rows are grouped under one heading per month. */
  monthKey: string
  /** "October 2026", computed on the server so server and browser agree. */
  monthLabel: string
  minutes: number
  thumb: { src: string; srcSet?: string; sizes?: string }
}

/**
 * The type filter, worded as what the reader is trying to do rather than as an
 * article taxonomy. Types not listed here fall back to their own label.
 */
const INTENT: Record<string, { label: string; detail: string }> = {
  'buying-guide': { label: 'Choosing what to buy', detail: 'Which device suits your home and budget' },
  'how-to': { label: 'Setting something up', detail: 'Step-by-step setup, pairing and fixes' },
  comparison: { label: 'Deciding between options', detail: 'Two or more products or platforms, side by side' },
  explainer: { label: 'Understanding how it works', detail: 'The technology, in plain language' },
  pillar: { label: 'Starting from scratch', detail: 'Complete guides to a whole topic' },
  roundup: { label: 'Browsing the options', detail: 'A shortlist across a category' },
  review: { label: 'Checking one product', detail: 'A single product, in detail' },
}

const FOCUS =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500'

/**
 * Every article, newest first, narrowed by what the reader is trying to do (type),
 * a topic and a title search, and grouped by month. All rows are server-rendered;
 * the controls only hide rows, so the list works and is crawlable without JavaScript.
 */
export default function ArticleIndex({
  rows,
  topics,
  types,
}: {
  rows: ArticleRow[]
  topics: { key: string; name: string }[]
  types: { type: string; label: string }[]
}) {
  const [query, setQuery] = useState('')
  const [topic, setTopic] = useState('')
  const [type, setType] = useState<string | null>(null)
  const searchId = useId()
  const topicId = useId()

  const q = query.trim().toLowerCase()
  const visible = (row: ArticleRow) =>
    (!topic || row.topic === topic) &&
    (!type || row.type === type) &&
    (!q || `${row.title} ${row.description}`.toLowerCase().includes(q))
  const shown = rows.filter(visible)
  const filtered = topic !== '' || type !== null || q !== ''

  const topicList = topics.filter((t) => rows.some((r) => r.topic === t.key))
  const typeList = types.filter((t) => rows.some((r) => r.type === t.type))

  // Month groups in list order (rows arrive newest first).
  const months: { key: string; label: string; rows: ArticleRow[] }[] = []
  for (const row of rows) {
    const last = months[months.length - 1]
    if (last?.key === row.monthKey) last.rows.push(row)
    else months.push({ key: row.monthKey, label: row.monthLabel, rows: [row] })
  }

  const clear = () => {
    setQuery('')
    setTopic('')
    setType(null)
  }

  return (
    <div>
      {/* What the reader needs: the type filter, as four (or more) plain choices. */}
      <section aria-labelledby="intent-heading">
        <h2 id="intent-heading" className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
          Start from what you need
        </h2>
        <ul className="mt-5 grid grid-cols-1 border-y border-neutral-200 sm:grid-cols-2 lg:grid-cols-4 dark:border-neutral-800">
          {typeList.map((t, i) => {
            const pressed = type === t.type
            const intent = INTENT[t.type] ?? { label: t.label, detail: '' }
            const count = rows.filter((r) => r.type === t.type).length
            return (
              <li
                key={t.type}
                className={`border-neutral-200 dark:border-neutral-800 ${i > 0 ? 'border-t sm:border-t-0' : ''} ${
                  i % 2 === 1 ? 'sm:border-l' : ''
                } ${i >= 2 ? 'sm:border-t lg:border-t-0' : ''} ${i > 0 ? 'lg:border-l' : ''}`}
              >
                <button
                  type="button"
                  aria-pressed={pressed}
                  onClick={() => setType(pressed ? null : t.type)}
                  className={`flex h-full w-full flex-col items-start gap-1 px-4 py-5 text-left transition-colors lg:px-5 ${FOCUS} ${
                    pressed
                      ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-950'
                      : 'text-neutral-900 hover:bg-neutral-100 dark:text-white dark:hover:bg-neutral-800/70'
                  }`}
                >
                  <span className="text-lg leading-snug font-bold">{intent.label}</span>
                  {intent.detail ? (
                    <span
                      className={`text-sm leading-snug ${
                        pressed ? 'text-white/80 dark:text-neutral-700' : 'text-neutral-600 dark:text-neutral-400'
                      }`}
                    >
                      {intent.detail}
                    </span>
                  ) : null}
                  <span
                    className={`mt-2 text-sm tabular-nums ${
                      pressed ? 'text-white/80 dark:text-neutral-700' : 'text-neutral-600 dark:text-neutral-400'
                    }`}
                  >
                    {count} {count === 1 ? 'guide' : 'guides'}
                    {pressed ? ', showing' : ''}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      {/* Search and topic, then the count and a way back to everything. */}
      <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="sm:w-80">
          <label htmlFor={searchId} className="block text-sm font-semibold text-neutral-900 dark:text-white">
            Search titles
          </label>
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. doorbell, Matter, solar"
            className={`mt-2 w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2.5 text-base text-neutral-900 placeholder:text-neutral-500 dark:border-neutral-700 dark:text-white ${FOCUS}`}
          />
        </div>
        <div className="sm:w-64">
          <label htmlFor={topicId} className="block text-sm font-semibold text-neutral-900 dark:text-white">
            Topic
          </label>
          <select
            id={topicId}
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className={`mt-2 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-base text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white ${FOCUS}`}
          >
            <option value="">All topics</option>
            {topicList.map((t) => (
              <option key={t.key} value={t.key}>
                {t.name} ({rows.filter((r) => r.topic === t.key).length})
              </option>
            ))}
          </select>
        </div>
        <p className="text-sm text-neutral-600 sm:ml-auto sm:pb-3 dark:text-neutral-400" aria-live="polite">
          <span className="font-semibold text-neutral-900 tabular-nums dark:text-white">{shown.length}</span> of{' '}
          <span className="tabular-nums">{rows.length}</span> guides
          {filtered ? (
            <>
              {' '}
              <button
                type="button"
                onClick={clear}
                className={`ml-2 font-semibold text-primary-600 underline underline-offset-4 dark:text-primary-400 ${FOCUS}`}
              >
                Clear filters
              </button>
            </>
          ) : null}
        </p>
      </div>

      {shown.length === 0 ? (
        <div className="mt-8 border-t border-neutral-200 py-10 dark:border-neutral-800">
          <p className="text-neutral-700 dark:text-neutral-300">No guide matches all of those filters.</p>
          <button
            type="button"
            onClick={clear}
            className={`mt-4 rounded-lg border border-neutral-300 px-5 py-2.5 text-sm font-semibold text-neutral-700 hover:border-neutral-900 hover:text-neutral-900 dark:border-neutral-700 dark:text-neutral-300 dark:hover:border-white dark:hover:text-white ${FOCUS}`}
          >
            Show every guide
          </button>
        </div>
      ) : null}

      {/* The list, one group per month. Rows are always in the HTML; filtering hides them. */}
      <div className="mt-8">
        {months.map((m) => {
          const inMonth = m.rows.filter(visible).length
          return (
            <section key={m.key} aria-labelledby={`month-${m.key}`} hidden={inMonth === 0} className="mt-10 first:mt-0">
              <h3
                id={`month-${m.key}`}
                className="flex items-baseline justify-between gap-4 border-b border-neutral-900 pb-2 text-base font-bold text-neutral-900 dark:border-white dark:text-white"
              >
                {m.label}
                <span className="text-sm font-normal text-neutral-600 tabular-nums dark:text-neutral-400">
                  {inMonth} {inMonth === 1 ? 'guide' : 'guides'}
                </span>
              </h3>
              <ul>
                {m.rows.map((row) => (
                  <li key={row.href} hidden={!visible(row)} className="border-b border-neutral-200 dark:border-neutral-800">
                    <Link href={row.href} className={`group flex items-start gap-4 py-4 sm:gap-5 ${FOCUS}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        {...row.thumb}
                        alt=""
                        width={112}
                        height={84}
                        loading="lazy"
                        className="hidden aspect-[4/3] w-28 shrink-0 rounded-lg object-cover sm:block"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[1.0625rem] leading-snug font-bold text-neutral-900 group-hover:text-primary-600 dark:text-white dark:group-hover:text-primary-400">
                          {row.title}
                        </span>
                        {row.description ? (
                          <span className="mt-1 line-clamp-2 block max-w-[68ch] text-sm leading-relaxed text-neutral-700 sm:line-clamp-1 dark:text-neutral-300">
                            {row.description}
                          </span>
                        ) : null}
                        <span className="mt-1.5 block text-sm text-neutral-600 dark:text-neutral-400">
                          {row.topicName} · {row.typeLabel} · <span className="tabular-nums">{row.minutes} min read</span>
                          <span className="sm:hidden">
                            {' '}
                            · <time dateTime={row.date} className="tabular-nums">{row.dateLabel}</time>
                          </span>
                        </span>
                      </span>
                      <time
                        dateTime={row.date}
                        className="hidden shrink-0 pt-0.5 text-sm text-neutral-600 tabular-nums sm:block dark:text-neutral-400"
                      >
                        {row.dateLabel}
                      </time>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
      </div>
    </div>
  )
}
