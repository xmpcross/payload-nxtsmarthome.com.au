'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { SearchDoc } from '@/lib/content';
import { articleHref } from '@/lib/urls';
import { site } from '@/lib/site';
import { responsiveImg } from '@/lib/image'

/**
 * Search results.
 *
 * Filtering happens as you type, and the ?q= seed exists so a link, the header
 * modal and the JSON-LD SearchAction all land somewhere useful.
 *
 * The reference design carries an author on every card. Every article here is
 * the editorial byline, so that is what is shown, with initials rather than a
 * photograph — the same identity content/authors/ uses, not an invented person.
 */

function score(doc: SearchDoc, terms: string[]): number {
  const title = doc.title.toLowerCase();
  const description = (doc.description ?? '').toLowerCase();
  const body = (doc.body ?? '').toLowerCase();
  const tags = (doc.tags ?? []).join(' ').toLowerCase();

  let total = 0;
  for (const term of terms) {
    if (title.includes(term)) total += 8;
    if (tags.includes(term)) total += 4;
    if (description.includes(term)) total += 3;
    if (body.includes(term)) total += 1;
  }
  return total;
}

const fmtDate = (iso: string) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-AU', {
      day: 'numeric', month: 'long', year: 'numeric',
    });
  } catch {
    return '';
  }
};

export default function SearchClient() {
  const [docs, setDocs] = useState<SearchDoc[]>([]);
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/search-index.json')
      .then((res) => res.json())
      .then((data: SearchDoc[]) => setDocs(data))
      .catch(() => setDocs([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('q');
    if (q) { setQuery(q); setDraft(q); }
  }, []);

  const results = useMemo(() => {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return [];
    return docs
      .map((doc) => ({ doc, s: score(doc, terms) }))
      .filter((r) => r.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 40)
      .map((r) => r.doc);
  }, [docs, query]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const term = draft.trim();
    setQuery(term);
    // Keep the URL in step so the result is linkable and survives a refresh.
    const url = term ? `/search/?q=${encodeURIComponent(term)}` : '/search/';
    window.history.replaceState(null, '', url);
  };

  const initials = site.organisation.name
    .split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

  return (
    <div>
      <nav aria-label="Breadcrumb" className="text-sm text-slate-500 dark:text-slate-400">
        <Link href="/" className="hover:text-slate-900 dark:hover:text-white">Home</Link>
        <span className="mx-2" aria-hidden="true">›</span>
        <span className="text-slate-900 dark:text-white">
          {query ? `You searched for ${query}` : 'Search'}
        </span>
      </nav>

      <h1 className="mt-4 text-4xl font-bold text-slate-900 sm:text-5xl dark:text-white">
        {query ? <>Search Results: {query}</> : 'Search'}
      </h1>

      <form onSubmit={submit} className="mt-7 flex max-w-xl gap-3">
        <label htmlFor="site-search" className="sr-only">Search articles</label>
        <input
          id="site-search"
          type="search"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Try “Matter”, “video doorbell”, “smart switch wiring”…"
          autoComplete="off"
          className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 outline-hidden transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
        />
        <button
          type="submit"
          className="shrink-0 rounded-lg bg-brand-600 px-7 py-3 font-bold text-white transition hover:bg-brand-700"
        >
          Search
        </button>
      </form>

      <div className="mt-8">
        {loading && <p className="text-sm text-slate-500 dark:text-slate-400">Loading search index…</p>}

        {!loading && query && (
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {results.length} {results.length === 1 ? 'Result' : 'Results'}
          </p>
        )}

        {!loading && !query && (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Start typing to search {docs.length} articles.
          </p>
        )}

        {!loading && query && results.length === 0 && (
          <p className="mt-4 text-slate-600 dark:text-slate-300">
            Nothing matched “{query}”. Try a broader term.
          </p>
        )}

        <ul className="mt-6 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((doc) => (
            <li
              key={doc.slug}
              className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:border-brand-300 hover:shadow-lg dark:border-slate-700 dark:bg-slate-900"
            >
              <Link href={articleHref(doc)} className="block">
                <img
                  {...responsiveImg(doc.cover ?? `/covers/${doc.slug}.png`, 640, '(max-width: 640px) 100vw, 33vw')}
                  alt={doc.title}
                  width={640}
                  height={360}
                  loading="lazy"
                  className="aspect-video w-full object-cover"
                />
              </Link>

              <div className="flex flex-1 flex-col p-6">
                {doc.categoryName && (
                  <Link
                    href={`/categories/${doc.categoryMeta?.slug ?? ''}/`}
                    className="text-sm font-semibold text-brand-600 hover:underline dark:text-brand-400"
                  >
                    {doc.categoryName}
                  </Link>
                )}

                <h2 className="mt-3 text-xl font-bold leading-snug text-slate-900 dark:text-white">
                  <Link href={articleHref(doc)} className="hover:underline">{doc.title}</Link>
                </h2>

                {doc.description && (
                  <p className="mt-3 flex gap-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                    <span aria-hidden="true" className="mt-0.5 shrink-0 text-brand-500">✦</span>
                    <span>{doc.description}</span>
                  </p>
                )}

                {/* Pushed to the bottom so cards of differing text length still
                    line their footers up across the row. */}
                <div className="mt-auto flex items-center justify-between gap-3 pt-6">
                  <span className="flex items-center gap-2.5">
                    <span
                      aria-hidden="true"
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700 dark:bg-brand-900 dark:text-brand-200"
                    >
                      {initials}
                    </span>
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      {site.organisation.name}
                    </span>
                  </span>
                  <time className="text-sm text-slate-500 dark:text-slate-400" dateTime={doc.date}>
                    {fmtDate(doc.date)}
                  </time>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
