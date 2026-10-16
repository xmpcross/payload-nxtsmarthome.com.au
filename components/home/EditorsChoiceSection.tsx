'use client'

import React, { useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import LocalDate from '@/components/LocalDate'
import type { TPost } from '@/data/posts'
import { responsiveImg } from '@/lib/image'

interface Props {
  posts: TPost[]
  heading?: string
}

export default function EditorsChoiceSection({ posts, heading = "Editors Choice" }: Props) {
  const displayPosts = posts.slice(0, 9)
  const [currentIndex, setCurrentIndex] = useState(0)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const totalItems = displayPosts.length

  const scrollToIndex = useCallback((index: number) => {
    const container = scrollContainerRef.current
    if (!container) return
    const card = container.children[index] as HTMLElement
    if (card) {
      container.scrollTo({
        left: card.offsetLeft,
        behavior: 'smooth',
      })
    }
    setCurrentIndex(index)
  }, [])

  const nextSlide = useCallback(() => {
    const nextIndex = (currentIndex + 1) % totalItems
    scrollToIndex(nextIndex)
  }, [currentIndex, totalItems, scrollToIndex])

  const prevSlide = useCallback(() => {
    const prevIndex = (currentIndex - 1 + totalItems) % totalItems
    scrollToIndex(prevIndex)
  }, [currentIndex, totalItems, scrollToIndex])

  if (!displayPosts.length) return null

  return (
    <section className="relative w-full">
      {/* Section Header */}
      <div className="relative mb-6 flex items-center justify-between border-b border-neutral-200 pb-3 dark:border-neutral-800">
        <div className="relative">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
            {heading}
          </h2>
          {/* Coral accent bar under title */}
          <span className="absolute -bottom-3.5 left-0 h-0.5 w-12 bg-primary-600 dark:bg-primary-400" />
        </div>

        {/* Carousel Prev/Next Buttons */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={prevSlide}
            className="flex size-8 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-600 transition hover:border-primary-500 hover:text-primary-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:border-primary-400 dark:hover:text-primary-400"
            aria-label="Previous Editor's Choice article"
          >
            <svg className="size-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          <button
            type="button"
            onClick={nextSlide}
            className="flex size-8 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-600 transition hover:border-primary-500 hover:text-primary-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:border-primary-400 dark:hover:text-primary-400"
            aria-label="Next Editor's Choice article"
          >
            <svg className="size-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
          </button>
        </div>
      </div>

      {/* 3-Column Horizontal Carousel Track */}
      <div
        ref={scrollContainerRef}
        className="flex snap-x snap-mandatory overflow-x-auto scrollbar-none gap-6 pb-2"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {displayPosts.map((post) => (
          <div
            key={post.id}
            className="w-full shrink-0 snap-start sm:w-[calc(50%-12px)] lg:w-[calc(33.333%-16px)]"
          >
            <Link href={`/${post.handle}`} className="group flex items-center gap-4">
              {/* Thumbnail Image */}
              <div className="relative size-28 sm:size-32 shrink-0 overflow-hidden rounded-2xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-800">
                {post.featuredImage?.src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    {...responsiveImg(post.featuredImage.src, 128, '128px')}
                    alt={post.featuredImage.alt || post.title}
                    width={128}
                    height={128}
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-primary-500/20 via-indigo-500/20 to-purple-500/20" />
                )}
              </div>

              {/* Right Side Content */}
              <div className="flex min-w-0 flex-1 flex-col justify-center">
                {/* Category Badge */}
                <span className="mb-1.5 inline-block w-fit rounded bg-primary-600 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white">
                  {post.categories?.[0]?.name || 'FEATURED'}
                </span>

                {/* Post Title */}
                <h3 className="text-sm sm:text-base font-bold leading-snug text-neutral-900 group-hover:text-primary-600 dark:text-white dark:group-hover:text-primary-400 line-clamp-2 transition-colors">
                  {post.title}
                </h3>

                {/* Date with Calendar Icon */}
                <div className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                  <svg className="size-3.5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
                  {post.date ? <LocalDate date={post.date} options={{ day: 'numeric', month: 'long', year: 'numeric' }} /> : null}
                </div>
              </div>
            </Link>
          </div>
        ))}
      </div>
    </section>
  )
}
