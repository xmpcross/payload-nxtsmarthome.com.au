'use client'

import StarRating from '@/components/StarRating'
import Link from 'next/link'
import { useId, useState } from 'react'
import AffiliateLink from '@/components/AffiliateLink'
import { responsiveImg } from '@/lib/image'

export interface CatalogueItem {
  slug: string
  name: string
  brand: string
  image?: string
  group: string
  groupLabel: string
  retailerName?: string
  retailerUrl?: string
  rating: number | null
  reviewCount: number
}

const FOCUS =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500'
const STEP = 24

const chip = (pressed: boolean) =>
  `rounded-full border px-3 py-1 text-sm font-medium transition-colors ${FOCUS} ${
    pressed
      ? 'border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-950'
      : 'border-neutral-300 text-neutral-700 hover:border-neutral-900 hover:text-neutral-900 dark:border-neutral-700 dark:text-neutral-300 dark:hover:border-white dark:hover:text-white'
  }`

/**
 * Every listed device as a compact, ruled list: search by name or brand, narrow
 * by a group (category on /products/, subcategory on a category page). Rows are
 * server-rendered; the controls only hide them. Without a filter the list shows
 * a first batch and a "Show all" button, so the page is not a wall of devices.
 */
export default function ProductCatalogue({
  items,
  groups,
  groupName,
}: {
  items: CatalogueItem[]
  groups: { key: string; label: string }[]
  /** What the chips filter by, for the group label, e.g. "Category". */
  groupName: string
}) {
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState<string | null>(null)
  const [limit, setLimit] = useState(STEP)
  const searchId = useId()

  const q = query.trim().toLowerCase()
  const matches = (i: CatalogueItem) =>
    (!group || i.group === group) && (!q || `${i.name} ${i.brand}`.toLowerCase().includes(q))
  const filtered = group !== null || q !== ''
  const matching = items.filter(matches)
  const visibleSlugs = new Set((filtered ? matching : matching.slice(0, limit)).map((i) => i.slug))
  const groupList = groups.filter((g) => items.some((i) => i.group === g.key))

  return (
    <div>
      <div className="space-y-4">
        <div className="max-w-md">
          <label htmlFor={searchId} className="text-sm font-semibold text-neutral-900 dark:text-white">
            Find a device
          </label>
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or brand"
            className={`mt-1.5 block w-full rounded-sm border border-neutral-300 bg-white px-3 py-2 text-neutral-900 placeholder:text-neutral-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white dark:placeholder:text-neutral-400 ${FOCUS}`}
          />
        </div>
        {groupList.length > 1 ? (
          <div role="group" aria-label={`Filter by ${groupName.toLowerCase()}`} className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-sm font-semibold text-neutral-900 dark:text-white">{groupName}</span>
            <button type="button" aria-pressed={group === null} onClick={() => setGroup(null)} className={chip(group === null)}>
              All <span className="tabular-nums opacity-70">{items.length}</span>
            </button>
            {groupList.map((g) => (
              <button
                key={g.key}
                type="button"
                aria-pressed={group === g.key}
                onClick={() => setGroup(group === g.key ? null : g.key)}
                className={chip(group === g.key)}
              >
                {g.label} <span className="tabular-nums opacity-70">{items.filter((i) => i.group === g.key).length}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <p className="mt-6 border-b border-neutral-200 pb-3 text-sm text-neutral-600 dark:border-neutral-800 dark:text-neutral-400" aria-live="polite">
        <span className="tabular-nums font-semibold text-neutral-900 dark:text-white">{matching.length}</span> of{' '}
        <span className="tabular-nums">{items.length}</span> devices
      </p>

      <ul className="grid gap-x-10 lg:grid-cols-2">
        {items.map((item) => (
          <li key={item.slug} hidden={!visibleSlugs.has(item.slug)} className="border-b border-neutral-200 dark:border-neutral-800">
            <div className="flex items-center gap-4 py-3">
              <span className="flex size-16 shrink-0 items-center justify-center rounded-md bg-white p-1.5 ring-1 ring-neutral-200 dark:ring-neutral-800">
                {item.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img {...responsiveImg(item.image, 128, '64px')} alt="" width={64} height={64} loading="lazy" className="max-h-full w-auto object-contain" />
                ) : null}
              </span>
              <span className="min-w-0 flex-1">
                <Link
                  href={`/products/${item.slug}/`}
                  className={`block rounded-sm font-semibold text-neutral-900 hover:text-primary-600 hover:underline hover:underline-offset-4 dark:text-neutral-100 dark:hover:text-primary-400 ${FOCUS}`}
                >
                  {item.name}
                </Link>
                <span className="mt-1 block"><StarRating rating={item.rating} count={item.reviewCount} /></span>
                <span className="mt-0.5 block text-sm text-neutral-600 dark:text-neutral-400">
                  {item.brand} · {item.groupLabel}
                </span>
              </span>
              {item.retailerUrl && item.retailerName ? (
                <AffiliateLink
                  href={item.retailerUrl}
                  subId={`catalogue-${item.slug}`}
                  className={`hidden shrink-0 rounded-full border border-primary-600 px-3 py-1.5 text-sm font-semibold text-primary-700 hover:bg-primary-600 hover:text-white sm:inline-flex dark:border-primary-400 dark:text-primary-300 dark:hover:bg-primary-500 dark:hover:text-white ${FOCUS}`}
                >
                  Check price at {item.retailerName}
                </AffiliateLink>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      {matching.length === 0 ? (
        <p className="py-8 text-neutral-700 dark:text-neutral-300">No devices match. Try a shorter search, or clear the filter.</p>
      ) : null}

      {!filtered && matching.length > limit ? (
        <div className="mt-6">
          <button
            type="button"
            onClick={() => setLimit(matching.length)}
            className={`rounded-full border border-neutral-300 px-5 py-2.5 text-sm font-bold text-neutral-900 hover:border-neutral-900 dark:border-neutral-700 dark:text-white dark:hover:border-white ${FOCUS}`}
          >
            Show all {matching.length} devices
          </button>
        </div>
      ) : null}
    </div>
  )
}
