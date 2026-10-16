import Link from 'next/link';
import SidebarTitle from './SidebarTitle';
import SidebarAd from './SidebarAd';
import FeaturedPostsSlider, { type FeaturedPost } from './FeaturedPostsSlider';

export type SidebarPost = {
  href: string;
  title: string;
  /** From lib/image responsiveImg: spread onto the <img>. */
  image: { src: string; srcSet?: string; sizes?: string };
  imageAlt: string;
  /** Already formatted for display (en-AU). */
  date: string;
  readingTime?: number;
};

export type SidebarTopic = { href: string; label: string };

/**
 * Single-post right sidebar, block for block from bestlooking.skin's article
 * sidebar (user request, 17 Oct 2026): Latest guides, a display ad slot,
 * Topics, then Featured Posts, which stays in view while the article scrolls.
 * The page chooses the posts (see [category]/[slug]/page.tsx).
 */
export default function PostSidebar({
  latest,
  topics,
  featured,
}: {
  latest: SidebarPost[];
  topics: SidebarTopic[];
  featured: FeaturedPost[];
}) {
  return (
    <aside aria-label="Article sidebar" className="mt-12 w-full lg:mt-0 lg:w-2/5 lg:ps-10 xl:w-1/3 xl:ps-0">
      {latest.length > 0 && (
        <div className="mb-10">
          {/* Newest guides. Not "trending": the site has no traffic data to rank by. */}
          <SidebarTitle>Latest guides</SidebarTitle>
          <div className="flex flex-col gap-3">
            {latest.map((post) => (
              <div
                key={post.href}
                className="relative flex items-center gap-4 rounded-2xl border border-neutral-200 bg-white p-4 transition hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900"
              >
                <div className="min-w-0 flex-1">
                  <Link
                    href={post.href}
                    className="line-clamp-2 text-[15px] leading-snug font-bold text-neutral-900 after:absolute after:inset-0 hover:text-primary-600 dark:text-white dark:hover:text-primary-400"
                  >
                    {post.title}
                  </Link>
                  <p className="mt-2 flex flex-wrap items-center gap-x-2 text-xs text-neutral-500 dark:text-neutral-400">
                    <span>{post.date}</span>
                    {post.readingTime ? (
                      <>
                        <span aria-hidden="true">•</span>
                        <span>{post.readingTime} min read</span>
                      </>
                    ) : null}
                  </p>
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  {...post.image}
                  alt=""
                  width={108}
                  height={83}
                  loading="lazy"
                  className="h-[83px] w-[108px] shrink-0 rounded-xl object-cover"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Renders nothing until AdSense is switched on and a sidebar unit exists. */}
      <SidebarAd className="mb-10" />

      {topics.length > 0 && (
        <div className="mb-10">
          <SidebarTitle>Topics</SidebarTitle>
          <ul className="flex flex-wrap gap-2">
            {topics.map((topic) => (
              <li key={topic.href}>
                <Link
                  href={topic.href}
                  className="inline-flex rounded-lg border border-neutral-200 px-4 py-2 text-[15px] text-neutral-800 transition hover:border-neutral-900 hover:text-neutral-900 dark:border-neutral-700 dark:text-neutral-200 dark:hover:border-white dark:hover:text-white"
                >
                  {topic.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {featured.length > 0 && (
        <div className="lg:sticky lg:top-7">
          <SidebarTitle>Featured Posts</SidebarTitle>
          <FeaturedPostsSlider posts={featured} />
        </div>
      )}
    </aside>
  );
}
