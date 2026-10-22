'use client'

import React from 'react'
import Link from 'next/link'
import LocalDate from '@/components/LocalDate'
import { site } from '@/lib/site'
import type { TPost } from '@/data/posts'
import type { TCategory } from '@/data/categories'
import { responsiveImg } from '@/lib/image'

interface Props {
  posts: TPost[]
  categories?: TCategory[]
}

// Reusable Section Header matching Zaira theme styling
function ZairaHeader({
  title,
  viewAllHref,
  as: HeadingTag = 'h2',
}: {
  title: string
  viewAllHref?: string
  as?: 'h2' | 'h3'
}) {
  const textSizeClass = HeadingTag === 'h3' ? 'text-[1.2rem]' : 'text-xl sm:text-2xl'

  return (
    <div className="relative mb-6 flex items-center justify-between border-b border-neutral-200 pb-3 dark:border-neutral-800">
      <div className="relative">
        <HeadingTag className={`${textSizeClass} font-bold tracking-tight text-neutral-900 dark:text-white`}>
          {title}
        </HeadingTag>
        {/* Coral accent bar under title */}
        <span className="absolute -bottom-3.5 left-0 h-0.5 w-12 bg-primary-600 dark:bg-primary-400" />
      </div>

      {viewAllHref && (
        <Link
          href={viewAllHref}
          className="flex items-center gap-1 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-neutral-600 transition hover:border-primary-500 hover:text-primary-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400 dark:hover:border-primary-400 dark:hover:text-primary-400"
        >
          <span>View All</span>
          <svg className="size-3.5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17 17 7"/><path d="M7 7h10v10"/></svg>
        </Link>
      )}
    </div>
  )
}

// New Interactive Smart Gear Showcase Widget for Right Sidebar
function SmartGearShowcaseWidget() {
  const gearItems = [
    {
      id: 'aqara-a100-smart-door-lock',
      title: 'Aqara A100 Smart Door Lock',
      category: 'SMART LOCKS',
      highlight: 'HomeKit & Fingerprint',
      href: '/products/aqara-a100-smart-door-lock/',
      image: '/images/products/aqara-a100-smart-door-lock.webp',
    },
    {
      id: 'echo-show-15-2nd-gen',
      title: 'Echo Show 15 2nd Gen',
      category: 'ENTERTAINMENT',
      highlight: '15.6" 1080p Smart Display',
      href: '/products/amazon-echo-show-15-2nd-gen/',
      image: '/images/products/amazon-echo-show-15-2nd-gen-sq500.webp',
    },
    {
      id: 'echo-hub-8-smart-home-control-panel',
      title: 'Echo Hub 8" Smart Control Panel',
      category: 'HUBS & PLATFORMS',
      highlight: 'Matter, Thread & Zigbee',
      href: '/products/amazon-echo-hub-8-smart-home-control-panel/',
      image: '/images/products/amazon-echo-hub-8-smart-home-control-panel-sq500.webp',
    },
    {
      id: 'arlo-ultra-2-4k-spotlight-camera',
      title: 'Arlo Ultra 2 4K Spotlight Camera',
      category: 'SECURITY CAMERAS',
      highlight: '4K HDR & Colour Night Vision',
      href: '/products/arlo-ultra-2-4k-spotlight-camera/',
      image: '/images/products/arlo-ultra-2-4k-spotlight-camera-sq500.webp',
    },
    {
      id: 'eufy-smart-lock-c220-with-wi-fi',
      title: 'Eufy Smart Lock C220 with Wi-Fi',
      category: 'SMART LOCKS',
      highlight: 'Built-in Wi-Fi & Keypad',
      href: '/products/eufy-smart-lock-c220-with-wi-fi/',
      image: '/images/products/eufy-smart-lock-c220-with-wi-fi-sq500.webp',
    },
  ]

  const [selectedIdx, setSelectedIdx] = React.useState(0)

  const featured = gearItems[selectedIdx]
  const subList = gearItems.filter((_, idx) => idx !== selectedIdx).slice(0, 3)

  return (
    <section className="space-y-4">
      {/* Widget Header with Direct Shop All Link */}
      <div className="flex items-center justify-between border-b border-neutral-200 pb-3 dark:border-neutral-800">
        <div className="relative">
          <h3 className="text-[1.2rem] font-bold tracking-tight text-neutral-900 dark:text-white">
            Featured Smart Gear
          </h3>
          <span className="absolute -bottom-3.5 left-0 h-0.5 w-12 bg-primary-600 dark:bg-primary-400" />
        </div>

        <Link
          href="/products/"
          className="flex items-center gap-1 rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-neutral-600 transition hover:border-primary-500 hover:text-primary-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400 dark:hover:border-primary-400 dark:hover:text-primary-400"
        >
          <span>Shop All</span>
          <svg className="size-3" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17 17 7"/><path d="M7 7h10v10"/></svg>
        </Link>
      </div>

      {/* Hero Featured Spotlight Card */}
      <Link
        href={featured.href}
        className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-neutral-200 bg-white p-4 transition-all duration-300 hover:border-primary-500 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-primary-400 shadow-sm"
      >
        <div className="relative h-48 w-full overflow-hidden rounded-xl bg-neutral-50 dark:bg-neutral-800/80 flex items-center justify-center p-4 border border-neutral-100 dark:border-neutral-800">
          {/* Top Category Badge */}
          <span className="absolute top-2.5 left-2.5 z-10 rounded-md bg-primary-600 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-white shadow-sm">
            {featured.category}
          </span>

          {/* Clean Un-tinted Product Image */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            {...responsiveImg(featured.image, 640, '(max-width: 700px) 100vw, 33vw')}
            alt={featured.title}
            className="h-full w-auto object-contain transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        </div>

        <div className="mt-3 space-y-1.5">
          <div className="flex items-center text-[11px]">
            <span className="font-semibold text-neutral-500 dark:text-neutral-400 text-[10px] uppercase tracking-wider">
              {featured.highlight}
            </span>
          </div>

          <h3 className="text-base font-bold leading-snug text-neutral-900 group-hover:text-primary-600 dark:text-white dark:group-hover:text-primary-400 line-clamp-2 transition-colors">
            {featured.title}
          </h3>

          <div className="pt-2 flex items-center justify-between border-t border-neutral-100 dark:border-neutral-800">
            <span className="text-xs font-bold text-primary-600 dark:text-primary-400 group-hover:underline flex items-center gap-1">
              View Gear Details
              <svg className="size-3.5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17 17 7"/><path d="M7 7h10v10"/></svg>
            </span>
            <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-widest">
              AU Retailers
            </span>
          </div>
        </div>
      </Link>

      {/* Mini Product Quick Selector List */}
      <div className="space-y-2.5 pt-1">
        {subList.map((item) => {
          const originalIdx = gearItems.findIndex((g) => g.id === item.id)
          return (
            <div
              key={item.id}
              className="group flex items-center justify-between gap-3 rounded-xl border border-neutral-200/70 bg-white p-2.5 transition-all duration-300 hover:border-primary-500 hover:bg-neutral-50/60 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-primary-400"
            >
              <button
                type="button"
                onClick={() => setSelectedIdx(originalIdx)}
                className="flex items-center gap-3 flex-1 min-w-0 text-left"
              >
                <div className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-neutral-50 dark:bg-neutral-800 p-1 border border-neutral-200 dark:border-neutral-800 flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.image} alt={item.title} className="h-full w-auto object-contain" loading="lazy" />
                </div>
                <div className="flex-1 min-w-0 space-y-0.5">
                  <span className="inline-block text-[9px] font-extrabold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                    {item.category}
                  </span>
                  <h4 className="text-xs font-bold leading-tight text-neutral-900 group-hover:text-primary-600 dark:text-white dark:group-hover:text-primary-400 line-clamp-1 transition-colors">
                    {item.title}
                  </h4>
                </div>
              </button>

              <Link
                href={item.href}
                className="shrink-0 flex size-8 items-center justify-center rounded-lg border border-neutral-200 bg-neutral-50 text-neutral-600 transition hover:border-primary-500 hover:bg-primary-600 hover:text-white dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-primary-600 dark:hover:text-white"
                title={`View ${item.title}`}
              >
                <svg className="size-3.5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17 17 7"/><path d="M7 7h10v10"/></svg>
              </Link>
            </div>
          )
        })}
      </div>
    </section>
  )
}

export default function ZairaBottomSections({ posts, categories = [] }: Props) {
  if (!posts.length) return null

  // Slices for different sections
  const recentPosts = posts.slice(0, 4)
  const recentFeatured = recentPosts[0]
  const recentList = recentPosts.slice(1, 4)

  const trendingPosts = posts.slice(4, 8).length >= 4 ? posts.slice(4, 8) : posts.slice(0, 4)
  const trendingFeatured = trendingPosts[0]
  const trendingGrid = trendingPosts.slice(1, 4)

  const latestPosts = posts.slice(0, 6)

  const popularPosts = posts.slice(12, 15).length >= 3 ? posts.slice(12, 15) : posts.slice(1, 4)

  const popularTechFeatured = posts[15] || posts[0]
  const popularTechList = posts.filter((p) => p.id !== popularTechFeatured?.id).slice(0, 4)

  // Default Hot Categories fallback
  const hotCategoriesList = categories.slice(0, 4).length > 0
    ? categories.slice(0, 4)
    : [
        { id: 'gadget', name: 'GADGET', handle: 'gadget', thumbnail: { src: posts[0]?.featuredImage?.src || '/og-default.png', alt: 'Gadget' } },
        { id: 'mobile', name: 'MOBILE', handle: 'mobile', thumbnail: { src: posts[1]?.featuredImage?.src || '/og-default.png', alt: 'Mobile' } },
        { id: 'news', name: 'NEWS', handle: 'news', thumbnail: { src: posts[2]?.featuredImage?.src || '/og-default.png', alt: 'News' } },
        { id: 'technology', name: 'TECHNOLOGY', handle: 'technology', thumbnail: { src: posts[3]?.featuredImage?.src || '/og-default.png', alt: 'Technology' } },
      ]

  return (
    <div className="w-full space-y-[50px]">
      {/* 1. TOP 2-COLUMN MAIN SECTION (Recent Posts & Trending News | Right Sidebar) */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-10">
        
        {/* LEFT MAIN COLUMN (8 cols) */}
        <div className="space-y-[50px] lg:col-span-8">
          
          {/* SECTION 1: RECENT POSTS */}
          <section>
            <ZairaHeader title="Recent Posts" viewAllHref="/articles/" />
            
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {/* Left Column: 1 Large Featured Post */}
              {recentFeatured && (
                <Link
                  href={`/${recentFeatured.handle}`}
                  className="group relative flex h-[420px] w-full flex-col justify-end overflow-hidden rounded-2xl p-6 border border-neutral-200 dark:border-neutral-800"
                >
                  {/* Background Image */}
                  {recentFeatured.featuredImage?.src ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      {...responsiveImg(recentFeatured.featuredImage.src, 1200, '(max-width: 1024px) 100vw, 50vw')}
                      alt={recentFeatured.featuredImage.alt || recentFeatured.title}
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-neutral-800" />
                  )}
                  {/* Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

                  {/* Card Content */}
                  <div className="relative z-10 space-y-2">
                    <span className="inline-block rounded bg-primary-600 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white">
                      {recentFeatured.categories?.[0]?.name || 'GADGET'}
                    </span>
                    
                    <h3 className="text-xl font-bold leading-snug text-white transition group-hover:text-primary-300 line-clamp-2">
                      {recentFeatured.title}
                    </h3>

                    {/* Meta Line */}
                    <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] font-semibold uppercase tracking-wider text-neutral-300">
                      <span className="flex items-center gap-1">
                        <svg className="size-3.5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                        BY {recentFeatured.author?.name || site.name}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <svg className="size-3.5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
                        {recentFeatured.date ? <LocalDate date={recentFeatured.date} options={{ day: 'numeric', month: 'long', year: 'numeric' }} /> : null}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <svg className="size-3.5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        {recentFeatured.readingTime || 3} MINS
                      </span>
                    </div>
                  </div>
                </Link>
              )}

              {/* Right Column: 3 Stacked Horizontal Posts */}
              <div className="flex flex-col justify-between space-y-4">
                {recentList.map((post) => (
                  <Link
                    key={post.id}
                    href={`/${post.handle}`}
                    className="group flex items-center justify-between gap-4 rounded-xl border-b border-neutral-100 pb-4 dark:border-neutral-800/80 last:border-none last:pb-0"
                  >
                    {/* Left Details */}
                    <div className="flex flex-1 flex-col justify-center min-w-0">
                      <span className="mb-1.5 inline-block w-fit rounded bg-primary-600 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white">
                        {post.categories?.[0]?.name || 'TECHNOLOGY'}
                      </span>
                      <h4 className="text-sm sm:text-base font-bold leading-snug text-neutral-900 group-hover:text-primary-600 dark:text-white dark:group-hover:text-primary-400 line-clamp-2 transition-colors">
                        {post.title}
                      </h4>
                      <div className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                        <svg className="size-3.5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
                        {post.date ? <LocalDate date={post.date} options={{ day: 'numeric', month: 'long', year: 'numeric' }} /> : null}
                      </div>
                    </div>

                    {/* Right Square Thumbnail */}
                    <div className="relative size-24 shrink-0 overflow-hidden rounded-2xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-800">
                      {post.featuredImage?.src ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          {...responsiveImg(post.featuredImage.src, 640, '(max-width: 700px) 100vw, 33vw')}
                          alt={post.featuredImage.alt || post.title}
                          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                          loading="lazy"
                        />
                      ) : (
                        <div className="absolute inset-0 bg-neutral-200 dark:bg-neutral-800" />
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>

          {/* FEATURED CATEGORY BANNER: SETUP GUIDES */}
          <Link
            href="/categories/setup-guides/"
            className="group relative flex overflow-hidden rounded-2xl border border-blue-500/30 bg-gradient-to-r from-slate-950 via-blue-950/80 to-indigo-950 p-6 text-white transition-all duration-500 hover:border-blue-400/60 hover:shadow-xl hover:shadow-blue-500/10"
          >
            {/* Ambient Animated Blue Radial Glow */}
            <div className="absolute -right-16 -top-16 size-64 rounded-full bg-blue-500/15 blur-3xl transition-opacity duration-700 group-hover:opacity-100" />
            
            {/* Grid Pattern Background */}
            <svg
              className="absolute inset-0 size-full opacity-10 stroke-neutral-400/20"
              width="100%"
              height="100%"
            >
              <pattern id="setup-banner-grid" width="24" height="24" patternUnits="userSpaceOnUse">
                <path d="M0 24V0h24" fill="none" strokeWidth="0.8" />
              </pattern>
              <rect width="100%" height="100%" fill="url(#setup-banner-grid)" />
            </svg>

            <div className="relative z-10 flex w-full flex-col sm:flex-row items-center justify-between gap-5">
              <div className="space-y-2 text-center sm:text-left min-w-0 flex-1">
                <div className="flex items-center justify-center sm:justify-start gap-2">
                  <span className="rounded bg-blue-600 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-widest text-white shadow-sm">
                    SETUP GUIDES
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-blue-300/80">
                    Step-by-Step Help
                  </span>
                </div>

                <h3 className="text-xl sm:text-2xl font-black tracking-tight text-white group-hover:text-blue-300 transition-colors">
                  Master Australian Smart Home Setup
                </h3>

                <p className="text-xs text-neutral-300 max-w-xl line-clamp-2 leading-relaxed">
                  From Wi-Fi troubleshooting and 2.4GHz pairing to Home Assistant automation & Australian electrical standards.
                </p>
              </div>

              <div className="shrink-0 flex items-center gap-2 rounded-xl border border-blue-400/40 bg-blue-600/90 px-5 py-3 text-xs font-bold uppercase tracking-wider text-white transition-all duration-300 group-hover:bg-blue-500 group-hover:scale-105 shadow-md">
                <span>Explore Setup Guides</span>
                <svg className="size-4 transition-transform duration-300 group-hover:translate-x-1" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
              </div>
            </div>
          </Link>

          {/* SECTION 2: TRENDING NEWS */}
          <section>
            <ZairaHeader title="Trending News" viewAllHref="/articles/" />

            <div className="space-y-6">
              {/* Top Featured Horizontal Card */}
              {trendingFeatured && (
                <div className="grid grid-cols-1 gap-6 border-0 p-0 bg-transparent md:grid-cols-2">
                  <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-neutral-100 dark:bg-neutral-800">
                    {trendingFeatured.featuredImage?.src ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        {...responsiveImg(trendingFeatured.featuredImage.src, 1200, '(max-width: 1024px) 100vw, 50vw')}
                        alt={trendingFeatured.featuredImage.alt || trendingFeatured.title}
                        className="absolute inset-0 h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-neutral-300 dark:bg-neutral-800" />
                    )}
                  </div>

                  <div className="flex flex-col justify-center space-y-3">
                    <span className="inline-block w-fit rounded bg-primary-600 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white">
                      {trendingFeatured.categories?.[0]?.name || 'Guide'}
                    </span>

                    <h3 className="text-lg sm:text-xl font-bold leading-snug text-neutral-900 dark:text-white line-clamp-2">
                      {trendingFeatured.title}
                    </h3>

                    <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                      <span>BY {trendingFeatured.author?.name || site.name}</span>
                      <span>•</span>
                      {trendingFeatured.date ? <LocalDate date={trendingFeatured.date} options={{ day: 'numeric', month: 'long', year: 'numeric' }} /> : null}
                    </div>

                    <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 line-clamp-3 leading-relaxed">
                      {trendingFeatured.excerpt ||
                        'Discover the latest tech accessories, smart home automation guides, and performance updates designed for modern Australian living.'}
                    </p>

                    <Link
                      href={`/${trendingFeatured.handle}`}
                      className="mt-2 flex w-fit items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-4 py-2 text-xs font-bold uppercase tracking-wider text-neutral-800 transition hover:border-primary-500 hover:text-primary-600 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:border-primary-400"
                    >
                      <span>Read More</span>
                      <svg className="size-3.5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17 17 7"/><path d="M7 7h10v10"/></svg>
                    </Link>
                  </div>
                </div>
              )}

              {/* Bottom 3 Vertical Column Cards */}
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
                {trendingGrid.map((post) => (
                  <Link key={post.id} href={`/${post.handle}`} className="group space-y-3">
                    <div className="relative aspect-[16/10] w-full overflow-hidden rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200/60 dark:border-neutral-800">
                      {post.featuredImage?.src ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          {...responsiveImg(post.featuredImage.src, 640, '(max-width: 700px) 100vw, 33vw')}
                          alt={post.featuredImage.alt || post.title}
                          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                          loading="lazy"
                        />
                      ) : (
                        <div className="absolute inset-0 bg-neutral-200 dark:bg-neutral-800" />
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <span className="inline-block rounded bg-primary-600 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white">
                        {post.categories?.[0]?.name || 'Guide'}
                      </span>
                      <h4 className="text-sm font-bold leading-snug text-neutral-900 group-hover:text-primary-600 dark:text-white dark:group-hover:text-primary-400 line-clamp-2 transition-colors">
                        {post.title}
                      </h4>
                      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                        <span>BY {post.author?.name || site.name}</span>
                        <span>•</span>
                        {post.date ? <LocalDate date={post.date} options={{ day: 'numeric', month: 'long', year: 'numeric' }} /> : null}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>

        </div>

        {/* RIGHT SIDEBAR COLUMN (4 cols) */}
        <div className="space-y-10 lg:col-span-4">
          
          {/* SIDEBAR BLOCK 1: FOLLOW. Only channels that exist. The template's six
              "#" social tiles and its "Daily Newsletter" form (which submitted
              nowhere) were removed (audit CQ10): there is no newsletter. */}
          <section>
            <ZairaHeader title="Follow NXT Smart Home" as="h3" />
            <div className="grid grid-cols-2 gap-2.5">
              {[
                ...(site.social.facebook ? [{ name: 'Facebook', href: site.social.facebook, external: true }] : []),
                ...(site.social.twitter ? [{ name: 'X (Twitter)', href: site.social.twitter, external: true }] : []),
                { name: 'RSS feed', href: '/feed.xml', external: false },
              ].map((item) => (
                <a
                  key={item.name}
                  href={item.href}
                  {...(item.external ? { target: '_blank', rel: 'noopener' } : {})}
                  className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-neutral-200/80 bg-neutral-100/80 px-3 py-2.5 text-xs font-bold text-neutral-700 transition hover:border-primary-500 hover:bg-primary-50 hover:text-primary-600 dark:border-neutral-800 dark:bg-neutral-800/80 dark:text-neutral-200 dark:hover:border-primary-400 dark:hover:bg-neutral-700"
                >
                  <span>{item.name}</span>
                </a>
              ))}
            </div>
          </section>

          {/* SIDEBAR BLOCK 3: HOT CATEGORIES */}
          <section>
            <ZairaHeader title="Hot Categories" as="h3" />
            <div className="space-y-3">
              {hotCategoriesList.map((cat) => (
                <Link
                  key={cat.id}
                  href={`/categories/${cat.handle || cat.id}/`}
                  className="group relative flex h-16 sm:h-20 w-full items-center justify-between overflow-hidden rounded-2xl p-4 shadow-sm border border-neutral-200/60 dark:border-neutral-800"
                >
                  {/* Background Image */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    {...responsiveImg(cat.thumbnail?.src || '/og-default.png', 384, '(max-width: 700px) 50vw, 20vw')}
                    alt={cat.name}
                    className="absolute inset-0 h-full w-full object-cover brightness-50 transition-transform duration-500 group-hover:scale-105 group-hover:brightness-40"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black/20" />

                  {/* Category Name */}
                  <span className="relative z-10 text-xs sm:text-sm font-extrabold uppercase tracking-widest text-white">
                    {cat.name}
                  </span>

                  {/* Action Arrow Icon */}
                  <div className="relative z-10 flex size-8 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-md transition duration-300 group-hover:bg-primary-600 group-hover:scale-110">
                    <svg className="size-3.5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17 17 7"/><path d="M7 7h10v10"/></svg>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          {/* SIDEBAR BLOCK 4: POPULAR POSTS */}
          <section>
            <ZairaHeader title="Popular Posts" as="h3" />
            <div className="space-y-4">
              {popularPosts.map((post) => (
                <Link
                  key={post.id}
                  href={`/${post.handle}`}
                  className="group flex items-center gap-3.5 border-b border-neutral-100 pb-3.5 dark:border-neutral-800/80 last:border-none last:pb-0"
                >
                  {/* Square Thumbnail */}
                  <div className="relative size-20 shrink-0 overflow-hidden rounded-2xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-800">
                    {post.featuredImage?.src ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        {...responsiveImg(post.featuredImage.src, 640, '(max-width: 700px) 100vw, 33vw')}
                        alt={post.featuredImage.alt || post.title}
                        className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        loading="lazy"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-neutral-200 dark:bg-neutral-800" />
                    )}
                  </div>

                  {/* Title & Metadata */}
                  <div className="flex flex-1 flex-col justify-center min-w-0 space-y-1">
                    <span className="inline-block w-fit rounded border border-neutral-300 dark:border-neutral-700 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400">
                      {post.categories?.[0]?.name || 'Guide'}
                    </span>
                    <h4 className="text-xs sm:text-sm font-bold leading-snug text-neutral-900 group-hover:text-primary-600 dark:text-white dark:group-hover:text-primary-400 line-clamp-2 transition-colors">
                      {post.title}
                    </h4>
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                      <svg className="size-3.5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
                      {post.date ? <LocalDate date={post.date} options={{ day: 'numeric', month: 'long', year: 'numeric' }} /> : null}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>



        </div>

      </div>

      {/* 2. BOTTOM PROMO BANNER (Resized to match top section banner) */}
      <div className="flex justify-center w-full">
        <a
          href="https://www.ebay.com.au/b/Smart-Home-Devices/185044/bn_7117565452"
          target="_blank"
          rel="noopener noreferrer sponsored"
          className="group relative flex w-full max-w-5xl overflow-hidden rounded-2xl border border-neutral-200/80 bg-slate-950 p-4 sm:p-6 text-white transition-all duration-500 dark:border-neutral-800 hover:border-amber-500/60 hover:shadow-xl hover:shadow-amber-500/10 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
        >
          {/* Ambient Multi-Color Gradient Glows */}
          <div className="absolute -left-16 -top-16 size-72 rounded-full bg-blue-600/15 blur-3xl transition-opacity duration-700 group-hover:opacity-100" />
          <div className="absolute -right-16 -bottom-16 size-72 rounded-full bg-amber-500/15 blur-3xl transition-opacity duration-700 group-hover:opacity-100" />

          {/* Minimal SVG Grid Pattern */}
          <svg
            className="absolute inset-0 size-full opacity-10 stroke-neutral-400/20"
            width="100%"
            height="100%"
          >
            <pattern id="ebay-banner-grid" width="28" height="28" patternUnits="userSpaceOnUse">
              <path d="M0 28V0h28" fill="none" strokeWidth="0.8" />
            </pattern>
            <rect width="100%" height="100%" fill="url(#ebay-banner-grid)" />
          </svg>

          {/* Top Right "Sponsored" Badge */}
          <div className="absolute top-2.5 right-3 z-20 flex items-center gap-2">
            <span className="rounded bg-black/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-300 backdrop-blur-md border border-white/10">
              Sponsored
            </span>
          </div>

          <div className="relative z-10 flex size-full flex-col justify-between gap-4 sm:flex-row sm:items-center">
            {/* Left Block: eBay Logo & Category Info */}
            <div className="space-y-2 max-w-lg">
              <div className="flex items-center gap-2.5">
                <div className="flex items-center text-amber-400 h-5 w-auto">
                  <svg className="h-5 w-auto" viewBox="0 0 100 30">
                    <text x="0" y="24" fontFamily="sans-serif" fontSize="24" fontWeight="900">
                      <tspan fill="#E53238">e</tspan>
                      <tspan fill="#0064D2">b</tspan>
                      <tspan fill="#F5AF02">a</tspan>
                      <tspan fill="#86B817">y</tspan>
                    </text>
                  </svg>
                </div>
                <span className="h-3.5 w-px bg-neutral-700" />
                <span className="text-[11px] font-extrabold uppercase tracking-widest text-amber-400">
                  Retail Deals
                </span>
              </div>

              <h3 className="text-base sm:text-lg md:text-xl font-bold tracking-tight text-white group-hover:text-amber-300 transition-colors duration-300 leading-snug">
                Find Smart Home Tech Deals on eBay AU
              </h3>

              <p className="text-xs text-neutral-300 line-clamp-1 sm:line-clamp-2 leading-relaxed">
                Shop verified Australian sellers offering Smart Locks, Cameras, Matter Hubs & Sensors with local delivery.
              </p>
            </div>

            {/* Right Action Button */}
            <div className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-extrabold uppercase tracking-wider text-neutral-950 transition-all duration-300 group-hover:bg-amber-400 group-hover:shadow-lg group-hover:shadow-amber-500/25 shrink-0">
              <span>Shop eBay AU</span>
              <svg className="size-4 transition-transform duration-300 group-hover:translate-x-1" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
            </div>
          </div>
        </a>
      </div>

      {/* 3. NEW BOTTOM 2-COLUMN SECTION UNDER THE BANNER */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-10">
        {/* Left Column (8 cols): Latest Posts */}
        <div className="lg:col-span-8">
          <section>
            <ZairaHeader title="Latest Posts" viewAllHref="/articles/" />

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              {latestPosts.map((post) => (
                <Link
                  key={post.id}
                  href={`/${post.handle}`}
                  className="group flex flex-col justify-between overflow-hidden border-0 p-0 bg-transparent transition-all duration-300"
                >
                  <div className="space-y-3">
                    <div className="relative aspect-[16/10] w-full overflow-hidden rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-800">
                      {post.featuredImage?.src ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          {...responsiveImg(post.featuredImage.src, 640, '(max-width: 700px) 100vw, 33vw')}
                          alt={post.featuredImage.alt || post.title}
                          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                          loading="lazy"
                        />
                      ) : (
                        <div className="absolute inset-0 bg-neutral-200 dark:bg-neutral-800" />
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <span className="inline-block rounded bg-primary-600 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white">
                        {post.categories?.[0]?.name || 'TECHNOLOGY'}
                      </span>
                      <h3 className="text-base font-bold leading-snug text-neutral-900 group-hover:text-primary-600 dark:text-white dark:group-hover:text-primary-400 line-clamp-2 transition-colors">
                        {post.title}
                      </h3>
                      <p className="text-xs text-neutral-600 dark:text-neutral-400 line-clamp-2 leading-relaxed">
                        {post.excerpt || 'Discover the latest smart home technology news and insights.'}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-neutral-100 pt-3 text-[11px] font-semibold text-neutral-400 dark:border-neutral-800">
                    {post.date ? <LocalDate date={post.date} options={{ day: 'numeric', month: 'long', year: 'numeric' }} /> : null}
                    <span>{post.readingTime || 2} MIN READ</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        </div>

        {/* Right Column (4 cols): Smart Gear Showcase & Popular Tech */}
        <div className="lg:col-span-4 flex flex-col justify-start space-y-10">
          <SmartGearShowcaseWidget />

          {/* Popular Tech Widget (Moved below the banner image) */}
          <section>
            <ZairaHeader title="Popular Tech" as="h3" />
            <div className="space-y-4">
              {/* Top Featured Overlay Post Card */}
              {popularTechFeatured && (
                <Link
                  href={`/${popularTechFeatured.handle}`}
                  className="group relative flex h-60 w-full flex-col justify-end overflow-hidden rounded-2xl p-5 border border-neutral-200 dark:border-neutral-800"
                >
                  {popularTechFeatured.featuredImage?.src ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      {...responsiveImg(popularTechFeatured.featuredImage.src, 1200, '(max-width: 1024px) 100vw, 50vw')}
                      alt={popularTechFeatured.featuredImage.alt || popularTechFeatured.title}
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-neutral-800" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />

                  <div className="relative z-10 space-y-1.5">
                    <span className="inline-block rounded bg-primary-600 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white">
                      {popularTechFeatured.categories?.[0]?.name || 'Guide'}
                    </span>
                    <h4 className="text-base font-bold leading-snug text-white group-hover:text-primary-300 line-clamp-2 transition-colors">
                      {popularTechFeatured.title}
                    </h4>
                    <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-300">
                      <span>BY {popularTechFeatured.author?.name || site.name}</span>
                      <span>•</span>
                      {popularTechFeatured.date ? <LocalDate date={popularTechFeatured.date} options={{ day: 'numeric', month: 'long', year: 'numeric' }} /> : null}
                    </div>
                  </div>
                </Link>
              )}

              {/* 3 Mini Posts List */}
              {popularTechList.map((post) => (
                <Link
                  key={post.id}
                  href={`/${post.handle}`}
                  className="group flex items-center gap-3.5 border-b border-neutral-100 pb-3.5 dark:border-neutral-800/80 last:border-none last:pb-0"
                >
                  <div className="relative size-20 shrink-0 overflow-hidden rounded-2xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-800">
                    {post.featuredImage?.src ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        {...responsiveImg(post.featuredImage.src, 640, '(max-width: 700px) 100vw, 33vw')}
                        alt={post.featuredImage.alt || post.title}
                        className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        loading="lazy"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-neutral-200 dark:bg-neutral-800" />
                    )}
                  </div>

                  <div className="flex flex-1 flex-col justify-center min-w-0 space-y-1">
                    <span className="inline-block w-fit rounded border border-neutral-300 dark:border-neutral-700 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400">
                      {post.categories?.[0]?.name || 'GADGET'}
                    </span>
                    <h4 className="text-xs sm:text-sm font-bold leading-snug text-neutral-900 group-hover:text-primary-600 dark:text-white dark:group-hover:text-primary-400 line-clamp-2 transition-colors">
                      {post.title}
                    </h4>
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                      <svg className="size-3.5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
                      {post.date ? <LocalDate date={post.date} options={{ day: 'numeric', month: 'long', year: 'numeric' }} /> : null}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
