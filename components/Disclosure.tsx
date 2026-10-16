import Link from 'next/link';
import { AFFILIATE_ENABLED } from '@/lib/affiliate';

/**
 * Affiliate disclosure. The ACCC expects this to be clear and up-front rather than
 * buried in a footer, so it renders above the article body on every post.
 */
export default function Disclosure({ compact = false }: { compact?: boolean }) {
  // No affiliate tracking running: no commission to disclose (lib/affiliate.ts).
  if (!AFFILIATE_ENABLED) return null;
  if (compact) {
    return (
      <p className="text-[14px] leading-[22px] text-slate-500 dark:text-slate-400">
        We may earn a commission from links on this page.{' '}
        <Link href="/affiliate-disclosure/" className="underline hover:text-brand-600">
          How this works
        </Link>
        .
      </p>
    );
  }

  return (
    <aside className="my-6 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-[14px] leading-[22px] text-slate-600 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300">
      <strong className="font-semibold text-slate-800 dark:text-slate-100">Heads up:</strong>{' '}
      when you buy through links on this page we may earn a commission, at no extra cost to
      you. It never changes which products we recommend or what we say about them.{' '}
      <Link href="/affiliate-disclosure/" target="_blank" rel="noopener noreferrer" className="font-medium text-brand-600 underline hover:text-brand-700 dark:text-brand-400">
        Read our full disclosure
      </Link>
      .
    </aside>
  );
}
