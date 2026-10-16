import type { Metadata } from 'next';
import { Suspense } from 'react';
import SearchClient from '@/components/SearchClient';

export const metadata: Metadata = {
  title: 'Search',
  description: 'Search every smart home guide, review and comparison on NXT Smart Home.',
  alternates: { canonical: '/search/' },
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
