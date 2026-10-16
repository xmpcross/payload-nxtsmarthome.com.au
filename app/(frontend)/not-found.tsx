import Link from 'next/link';
import { categories } from '@/lib/site';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-20 text-center">
      <p className="text-6xl font-extrabold text-brand-600">404</p>
      <h1 className="mt-4 text-3xl font-bold text-slate-900 dark:text-white">
        We can&apos;t find that page
      </h1>
      <p className="mt-3 text-slate-600 dark:text-slate-300">
        The link may be out of date, or the page may have moved. Try a topic below, or search
        the site.
      </p>

      <div className="mt-8 flex flex-wrap justify-center gap-2">
        {categories.map((category) => (
          <Link
            key={category.slug}
            href={`/categories/${category.slug}/`}
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-brand-400 hover:text-brand-700 dark:border-slate-700 dark:text-slate-300"
          >
            {category.emoji} {category.name}
          </Link>
        ))}
      </div>

      <div className="mt-8 flex justify-center gap-3">
        <Link
          href="/"
          className="rounded-lg bg-brand-600 px-5 py-2.5 font-semibold text-white hover:bg-brand-700"
        >
          Go home
        </Link>
        <Link
          href="/search/"
          className="rounded-lg border border-slate-300 px-5 py-2.5 font-semibold text-slate-700 hover:border-brand-400 dark:border-slate-600 dark:text-slate-200"
        >
          Search
        </Link>
      </div>
    </div>
  );
}
