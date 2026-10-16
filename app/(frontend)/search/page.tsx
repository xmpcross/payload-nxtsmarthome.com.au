import type { Metadata } from 'next';
import { Suspense } from 'react';
import SearchClient from '@/components/SearchClient';
import { pageAlternates, pageTitle } from '@/lib/seo';

/*
 * ISR rather than fully static: a static page is sent with
 * s-maxage=31536000, so a CDN that honours it would hold this shell for a
 * year (audit M6). 300s + stale-while-revalidate, like the articles.
 */
export const revalidate = 300;

export const metadata: Metadata = {
  title: pageTitle('Search'),
  description: 'Search every smart home guide, review and comparison on NXT Smart Home.',
  alternates: pageAlternates('/search/'),
  robots: { index: false, follow: true },
};

export default function SearchPage() {
  return (
    /* Full site width: the results are a three-up card grid, which a 3xl
       column would squeeze into one. The heading moved into SearchClient
       because it names the query, which only the client knows. */
    <div className="container py-14 lg:py-20">
      <Suspense fallback={<p className="text-sm text-slate-500">Loading…</p>}>
        <SearchClient />
      </Suspense>
    </div>
  );
}
