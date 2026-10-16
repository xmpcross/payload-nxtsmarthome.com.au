import Link from 'next/link';
import type { TPost } from '@/data/posts';
import { responsiveImg } from '@/lib/image'

/** Wide lead card for the newest article, shared by /articles/ and the topic pages. */
export default function LeadArticleCard({ post, className = '' }: { post: TPost; className?: string }) {
  return (
    <Link
      href={`/${post.handle}/`}
      className={`group grid overflow-hidden rounded-2xl border border-neutral-200 bg-white transition hover:border-primary-300 hover:shadow-md sm:grid-cols-5 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-primary-700 ${className}`}
    >
      <div className="relative aspect-16/10 sm:col-span-2 sm:aspect-auto sm:min-h-56">
        {post.featuredImage?.src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            {...responsiveImg(post.featuredImage.src, 1200, '(max-width: 1024px) 100vw, 50vw')}
            alt={post.featuredImage.alt || post.title}
            width={1200}
            height={750}
            className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary-100 to-primary-50 dark:from-primary-950/60 dark:to-neutral-900" />
        )}
      </div>
      <div className="flex flex-col p-6 sm:col-span-3 lg:p-8">
        <span className="text-xs font-semibold tracking-wider text-primary-700 uppercase dark:text-primary-300">
          Newest article
        </span>
        <h2 className="mt-2 text-2xl leading-snug font-bold text-neutral-900 group-hover:text-primary-700 dark:text-white dark:group-hover:text-primary-300">
          {post.title}
        </h2>
        {post.excerpt && <p className="mt-3 line-clamp-3 text-neutral-600 dark:text-neutral-300">{post.excerpt}</p>}
        <span className="mt-auto pt-4 text-xs text-neutral-500 dark:text-neutral-400">
          {post.categories[0]?.name} · {post.readingTime} min read
        </span>
      </div>
    </Link>
  );
}
