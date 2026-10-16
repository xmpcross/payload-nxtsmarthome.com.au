'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import type { TPost } from '@/data/posts';
import { responsiveImg } from '@/lib/image'

export type TopicCategoryData = {
  id: string | number;
  name: string;
  handle: string;
  count: number;
  description: string;
  emoji?: string;
  icon3d?: string;
  iconSvg?: string;
  intro?: string;
  subcategories?: string[];
  hasProducts: boolean;
};

interface AllTopicsClientProps {
  categories: TopicCategoryData[];
  posts: TPost[];
}

export default function AllTopicsClient({ categories, posts }: AllTopicsClientProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'readTime' | 'title'>('newest');
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'categorized'>('grid');
  const [visibleCount, setVisibleCount] = useState(12);

  // Filter out hidden categories like robot-vacuums
  const activeCategories = useMemo(() => {
    return categories.filter(
      (cat) => cat.handle !== 'robot-vacuums' && cat.handle !== 'robot-vacuum'
    );
  }, [categories]);

  // Extract all unique subcategories across all active topics
  const allSubcategories = useMemo(() => {
    const tags = new Set<string>();
    activeCategories.forEach((cat) => {
      cat.subcategories?.forEach((sub) => tags.add(sub));
    });
    return Array.from(tags).sort();
  }, [activeCategories]);

  // Filter categories based on search & tag
  const filteredCategories = useMemo(() => {
    return activeCategories.filter((cat) => {
      const matchesSearch =
        searchQuery === '' ||
        cat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cat.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (cat.intro && cat.intro.toLowerCase().includes(searchQuery.toLowerCase())) ||
        cat.subcategories?.some((sub) => sub.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesTag =
        !selectedTag || cat.subcategories?.some((sub) => sub === selectedTag);

      const matchesCategoryFilter =
        !selectedCategory || cat.handle === selectedCategory;

      return matchesSearch && matchesTag && matchesCategoryFilter;
    });
  }, [activeCategories, searchQuery, selectedTag, selectedCategory]);

  // Filter & sort posts based on search, selected category, and selected tag
  const filteredPosts = useMemo(() => {
    let result = posts.filter((post) => {
      // Category match
      const postCatSlug = post.categories?.[0]?.handle || post.categories?.[0]?.id;
      const matchesCat =
        !selectedCategory ||
        post.categories?.some(
          (c) => c.handle === selectedCategory || c.id === selectedCategory
        );

      // Search match (title, excerpt, category)
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        q === '' ||
        post.title.toLowerCase().includes(q) ||
        (post.excerpt && post.excerpt.toLowerCase().includes(q)) ||
        post.categories?.some((c) => c.name.toLowerCase().includes(q));

      return matchesCat && matchesSearch;
    });

    // Sorting logic
    result = [...result].sort((a, b) => {
      if (sortBy === 'newest') {
        return new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime();
      }
      if (sortBy === 'oldest') {
        return new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime();
      }
      if (sortBy === 'readTime') {
        return (a.readingTime || 0) - (b.readingTime || 0);
      }
      if (sortBy === 'title') {
        return a.title.localeCompare(b.title);
      }
      return 0;
    });

    return result;
  }, [posts, selectedCategory, searchQuery, sortBy]);

  // Group posts by category for 'categorized' view
  const postsByCategory = useMemo(() => {
    const map = new Map<string, { category: TopicCategoryData; items: TPost[] }>();
    activeCategories.forEach((cat) => {
      map.set(cat.handle, { category: cat, items: [] });
    });

    filteredPosts.forEach((post) => {
      const catSlug = post.categories?.[0]?.handle || post.categories?.[0]?.id;
      if (catSlug && map.has(catSlug)) {
        map.get(catSlug)!.items.push(post);
      } else {
        // Fallback to first matching category or general
        const foundKey = Array.from(map.keys())[0];
        if (foundKey) map.get(foundKey)?.items.push(post);
      }
    });

    return Array.from(map.values()).filter((group) => group.items.length > 0);
  }, [activeCategories, filteredPosts]);

  const displayedPosts = filteredPosts.slice(0, visibleCount);

  return (
    <div className="space-y-12">
      {/* 1. TOP INTERACTIVE SEARCH & FILTER CONTROLS */}
      <div className="relative bg-transparent p-0 border-none shadow-none">
        
        {/* Main Search & Sort Controls Row */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* Search Box */}
          <div className="relative flex-1">
            <div className="absolute inset-y-0 start-0 flex items-center ps-4 pointer-events-none text-neutral-400">
              <svg className="size-5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setVisibleCount(12);
              }}
              placeholder="Search all guides, topics & articles (e.g., Matter, Wi-Fi, Cameras, HomeKit)..."
              className="w-full rounded-2xl border border-neutral-200 bg-neutral-50/60 py-3.5 ps-12 pe-10 text-sm font-medium text-neutral-900 transition-all placeholder:text-neutral-400 focus:border-primary-500 focus:bg-white focus:outline-none dark:border-neutral-700 dark:bg-neutral-800/60 dark:text-white dark:focus:border-primary-400 dark:focus:bg-neutral-800"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 end-0 flex items-center pe-4 text-xs font-semibold text-neutral-400 hover:text-neutral-600 dark:hover:text-white"
              >
                Clear
              </button>
            )}
          </div>

          {/* Sort Selector & Layout Switcher */}
          <div className="flex flex-wrap items-center justify-between lg:justify-end gap-3">
            
            {/* Sort Dropdown */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider hidden sm:inline">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs font-bold text-neutral-700 focus:border-primary-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
              >
                <option value="newest">Latest Articles</option>
                <option value="oldest">Oldest Articles</option>
                <option value="readTime">Fastest Read Time</option>
                <option value="title">Alphabetical (A-Z)</option>
              </select>
            </div>

            {/* Layout Toggle Buttons */}
            <div className="inline-flex rounded-xl border border-neutral-200 bg-neutral-100 p-1 dark:border-neutral-700 dark:bg-neutral-800">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                title="Grid View"
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  viewMode === 'grid'
                    ? 'bg-white text-primary-600 dark:bg-neutral-700 dark:text-white shadow-xs'
                    : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'
                }`}
              >
                <svg className="size-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>
                Grid
              </button>

              <button
                type="button"
                onClick={() => setViewMode('list')}
                title="List View"
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  viewMode === 'list'
                    ? 'bg-white text-primary-600 dark:bg-neutral-700 dark:text-white shadow-xs'
                    : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'
                }`}
              >
                <svg className="size-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/></svg>
                Compact List
              </button>

              <button
                type="button"
                onClick={() => setViewMode('categorized')}
                title="Grouped By Category"
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  viewMode === 'categorized'
                    ? 'bg-white text-primary-600 dark:bg-neutral-700 dark:text-white shadow-xs'
                    : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'
                }`}
              >
                <svg className="size-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>
                By Category
              </button>
            </div>

          </div>
        </div>

        {/* Category Selector Tabs */}
        <div className="mt-6 pt-5 border-t border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
              Filter By Topic Category
            </span>
            {(selectedCategory || selectedTag || searchQuery) && (
              <button
                onClick={() => {
                  setSelectedCategory(null);
                  setSelectedTag(null);
                  setSearchQuery('');
                  setVisibleCount(12);
                }}
                className="text-xs font-extrabold text-primary-600 hover:underline dark:text-primary-400"
              >
                Reset All Filters
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                setSelectedCategory(null);
                setVisibleCount(12);
              }}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-extrabold transition-all ${
                selectedCategory === null
                  ? 'bg-primary-600 text-white shadow-xs'
                  : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700'
              }`}
            >
              All Articles ({posts.length})
            </button>

            {activeCategories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => {
                  setSelectedCategory(selectedCategory === cat.handle ? null : cat.handle);
                  setVisibleCount(12);
                }}
                className={`flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-extrabold transition-all ${
                  selectedCategory === cat.handle
                    ? 'bg-primary-600 text-white shadow-xs'
                    : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700'
                }`}
              >
                {cat.iconSvg ? (
                  <img src={cat.iconSvg} alt=""
                    width={16}
                    height={16} className="size-4 shrink-0 object-contain" />
                ) : (
                  <span>{cat.emoji || '⚡'}</span>
                )}
                <span>{cat.name}</span>
                <span className="rounded-full bg-black/10 px-1.5 py-0.2 text-[10px] dark:bg-white/10">
                  {cat.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Sub-Topic Focus Pills */}
        {allSubcategories.length > 0 && (
          <div className="mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-800/60">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-neutral-400 shrink-0">
                Focus:
              </span>
              {allSubcategories.map((sub) => (
                <button
                  key={sub}
                  onClick={() => {
                    setSelectedTag(selectedTag === sub ? null : sub);
                    setVisibleCount(12);
                  }}
                  className={`shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all ${
                    selectedTag === sub
                      ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                      : 'bg-neutral-100/80 text-neutral-600 hover:bg-neutral-200/80 dark:bg-neutral-800/80 dark:text-neutral-400 dark:hover:bg-neutral-700'
                  }`}
                >
                  {sub}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 2. CATEGORIES OVERVIEW GRID (SHOWCASE) */}
      {!selectedCategory && !searchQuery && (
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-200 pb-3 dark:border-neutral-800">
            <div className="relative">
              <h2 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white">
                Explore Categories
              </h2>
              <span className="absolute -bottom-3.5 left-0 h-0.5 w-12 bg-primary-600 dark:bg-primary-400" />
            </div>
            <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
              {filteredCategories.length} Topics
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {filteredCategories.map((c) => (
              <div
                key={c.id}
                className="group relative flex flex-col justify-between rounded-2xl border border-neutral-200/80 bg-white p-5 transition-all duration-300 hover:border-primary-500 hover:bg-neutral-50/50 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-primary-400"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <span className="flex size-10 items-center justify-center p-0 m-0 bg-transparent shrink-0 transition-transform duration-300 group-hover:scale-110">
                      {c.icon3d ? (
                        <img
                          {...responsiveImg(c.icon3d, 72, '72px')}
                          alt={c.name}
                          width={40}
                          height={40}
                          className="size-10 object-contain p-0 m-0"
                        />
                      ) : (
                        <span className="text-2xl p-0 m-0">{c.emoji || '⚡'}</span>
                      )}
                    </span>
                    <span className="rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-extrabold text-primary-700 border border-primary-500/20 dark:bg-primary-950/60 dark:text-primary-300">
                      {c.count} {c.count === 1 ? 'Guide' : 'Guides'}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-neutral-900 group-hover:text-primary-600 dark:text-white dark:group-hover:text-primary-400 transition-colors">
                      <Link href={`/categories/${c.handle}/`}>{c.name}</Link>
                    </h3>
                    <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400 line-clamp-2 leading-relaxed">
                      {c.intro || c.description}
                    </p>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
                  <button
                    onClick={() => {
                      setSelectedCategory(c.handle);
                      setVisibleCount(12);
                    }}
                    className="text-xs font-bold text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1"
                  >
                    Filter Articles
                    <svg className="size-3" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17 17 7"/><path d="M7 7h10v10"/></svg>
                  </button>

                  <Link
                    href={`/categories/${c.handle}/`}
                    className="text-[11px] font-semibold text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                  >
                    View Category →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 3. MAIN ARTICLES FEED & DISPLAY */}
      <section className="space-y-6">
        {/* Section Header & Active Status */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-200 pb-3 dark:border-neutral-800">
          <div className="relative">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 dark:text-white flex items-center gap-2">
              <span>
                {selectedCategory
                  ? activeCategories.find((c) => c.handle === selectedCategory)?.name || 'Category'
                  : 'All Published Guides & Articles'}
              </span>
              <span className="text-xs font-bold text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-950/60 px-2.5 py-0.5 rounded-full border border-primary-500/20">
                {filteredPosts.length} Articles
              </span>
            </h2>
            <span className="absolute -bottom-3.5 left-0 h-0.5 w-12 bg-primary-600 dark:bg-primary-400" />
          </div>

          <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
            Showing {displayedPosts.length} of {filteredPosts.length} Articles
          </span>
        </div>

        {/* Empty State */}
        {filteredPosts.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-neutral-300 p-12 text-center dark:border-neutral-800 bg-white dark:bg-neutral-900">
            <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-neutral-100 text-3xl dark:bg-neutral-800">
              🔍
            </div>
            <h3 className="mt-4 text-lg font-bold text-neutral-900 dark:text-white">
              No matching guides found
            </h3>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              We couldn&apos;t find any articles matching &ldquo;{searchQuery}&rdquo;.
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory(null);
                setSelectedTag(null);
                setVisibleCount(12);
              }}
              className="mt-5 rounded-xl bg-primary-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-primary-700 shadow-sm"
            >
              Reset All Filters
            </button>
          </div>
        ) : viewMode === 'categorized' ? (
          /* CATEGORIZED VIEW: Articles Grouped By Category */
          <div className="space-y-12">
            {postsByCategory.map(({ category, items }) => (
              <div key={category.id} className="space-y-4">
                <div className="flex items-center justify-between border-b border-neutral-100 pb-2 dark:border-neutral-800">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{category.emoji || '⚡'}</span>
                    <h3 className="text-lg font-bold text-neutral-900 dark:text-white">
                      {category.name}
                    </h3>
                    <span className="text-xs font-semibold text-neutral-400">
                      ({items.length} {items.length === 1 ? 'article' : 'articles'})
                    </span>
                  </div>
                  <Link
                    href={`/categories/${category.handle}/`}
                    className="text-xs font-bold text-primary-600 hover:underline dark:text-primary-400"
                  >
                    View Category Page →
                  </Link>
                </div>

                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((post) => (
                    <Link
                      key={post.id}
                      href={`/${post.handle}/`}
                      className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-neutral-200/80 bg-white p-4 transition-all duration-300 hover:border-primary-500 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-primary-400 shadow-xs"
                    >
                      <div className="space-y-3">
                        <div className="relative aspect-[16/10] w-full overflow-hidden rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-800">
                          {post.featuredImage?.src ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              {...responsiveImg(post.featuredImage.src, 640, '(max-width: 700px) 100vw, 33vw')}
                              alt={post.featuredImage.alt || post.title}
                              width={640}
                              height={400}
                              className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                              loading="lazy"
                            />
                          ) : (
                            <div className="absolute inset-0 bg-neutral-200 dark:bg-neutral-800" />
                          )}
                        </div>

                        <div className="space-y-1.5">
                          <span className="inline-block rounded bg-primary-600 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white">
                            {post.categories?.[0]?.name || category.name}
                          </span>
                          <h4 className="text-base font-bold leading-snug text-neutral-900 group-hover:text-primary-600 dark:text-white dark:group-hover:text-primary-400 line-clamp-2 transition-colors">
                            {post.title}
                          </h4>
                          <p className="text-xs text-neutral-600 dark:text-neutral-400 line-clamp-2 leading-relaxed">
                            {post.excerpt || 'Explore Australian smart home guides & recommendations.'}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-between border-t border-neutral-100 pt-3 text-[11px] font-semibold text-neutral-400 dark:border-neutral-800">
                        <span>{post.date || 'OCTOBER 2025'}</span>
                        <span>{post.readingTime || 3} MIN READ</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : viewMode === 'list' ? (
          /* LIST VIEW: Compact Horizontal Article List */
          <div className="space-y-3">
            {displayedPosts.map((post) => (
              <Link
                key={post.id}
                href={`/${post.handle}/`}
                className="group flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border border-neutral-200/80 bg-white p-4 transition-all duration-300 hover:border-primary-500 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-primary-400 shadow-xs"
              >
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  {/* Square Thumbnail */}
                  <div className="relative size-20 sm:size-24 shrink-0 overflow-hidden rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-800">
                    {post.featuredImage?.src ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        {...responsiveImg(post.featuredImage.src, 96, '96px')}
                        alt={post.featuredImage.alt || post.title}
                        width={96}
                        height={96}
                        className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        loading="lazy"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-neutral-200 dark:bg-neutral-800" />
                    )}
                  </div>

                  {/* Title & Metadata */}
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <span className="inline-block rounded bg-primary-600 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white">
                      {post.categories?.[0]?.name || 'SMART HOME'}
                    </span>
                    <h3 className="text-sm sm:text-base font-bold leading-snug text-neutral-900 group-hover:text-primary-600 dark:text-white dark:group-hover:text-primary-400 line-clamp-2 transition-colors">
                      {post.title}
                    </h3>
                    <p className="text-xs text-neutral-600 dark:text-neutral-400 line-clamp-1 leading-relaxed hidden sm:block">
                      {post.excerpt}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 self-end sm:self-center text-xs font-semibold text-neutral-400">
                  <span>{post.date || 'OCTOBER 2025'}</span>
                  <span>•</span>
                  <span>{post.readingTime || 3} MIN</span>
                  <div className="flex size-8 items-center justify-center rounded-lg border border-neutral-200 bg-neutral-50 text-neutral-600 group-hover:bg-primary-600 group-hover:text-white dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                    <svg className="size-3.5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17 17 7"/><path d="M7 7h10v10"/></svg>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          /* GRID VIEW: 3-Column Responsive Cards Grid */
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {displayedPosts.map((post) => (
              <Link
                key={post.id}
                href={`/${post.handle}/`}
                className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-neutral-200/80 bg-white p-4 transition-all duration-300 hover:border-primary-500 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-primary-400 shadow-xs"
              >
                <div className="space-y-3">
                  {/* Thumbnail Container */}
                  <div className="relative aspect-[16/10] w-full overflow-hidden rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-800">
                    {post.featuredImage?.src ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        {...responsiveImg(post.featuredImage.src, 640, '(max-width: 700px) 100vw, 33vw')}
                        alt={post.featuredImage.alt || post.title}
                        width={640}
                        height={400}
                        className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        loading="lazy"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-neutral-200 dark:bg-neutral-800" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="space-y-1.5">
                    <span className="inline-block rounded bg-primary-600 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white">
                      {post.categories?.[0]?.name || 'SMART HOME'}
                    </span>
                    <h3 className="text-base font-bold leading-snug text-neutral-900 group-hover:text-primary-600 dark:text-white dark:group-hover:text-primary-400 line-clamp-2 transition-colors">
                      {post.title}
                    </h3>
                    <p className="text-xs text-neutral-600 dark:text-neutral-400 line-clamp-2 leading-relaxed">
                      {post.excerpt || 'Explore independent smart home buying guides & Australian setup advice.'}
                    </p>
                  </div>
                </div>

                {/* Footer Metadata */}
                <div className="mt-4 flex items-center justify-between border-t border-neutral-100 pt-3 text-[11px] font-semibold text-neutral-400 dark:border-neutral-800">
                  <span>{post.date || 'OCTOBER 2025'}</span>
                  <span>{post.readingTime || 3} MIN READ</span>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Load More Button */}
        {viewMode !== 'categorized' && displayedPosts.length < filteredPosts.length && (
          <div className="pt-6 text-center">
            <button
              onClick={() => setVisibleCount((prev) => prev + 12)}
              className="inline-flex items-center gap-2 rounded-2xl border border-neutral-300 bg-white px-8 py-3.5 text-xs font-extrabold uppercase tracking-wider text-neutral-900 transition hover:border-primary-500 hover:bg-primary-600 hover:text-white dark:border-neutral-700 dark:bg-neutral-900 dark:text-white dark:hover:bg-primary-600 shadow-sm"
            >
              <span>Load More Articles ({filteredPosts.length - displayedPosts.length} Remaining)</span>
              <svg className="size-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
