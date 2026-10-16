import type { FaqItem } from '@/lib/content';

/**
 * Article FAQ ("FAQs"), single post template.
 *
 * Heading over a hairline rule, then one row per question: the question in
 * semibold on the left, a plus on the right that turns into a minus when open,
 * hairline rules between rows. No background (transparent, per design).
 *
 * Every question starts collapsed. <details> keeps it working without
 * JavaScript, and the answer stays in the DOM, so it is still crawlable and
 * still backs the FAQPage structured data while hidden.
 */
export default function Faq({ items }: { items: FaqItem[] }) {
  if (!items?.length) return null;

  return (
    <section className="not-prose mt-12 bg-transparent" aria-labelledby="faq-heading">
      <h2 id="faq-heading" className="text-2xl font-bold text-neutral-900 dark:text-white">
        FAQs
      </h2>

      <div className="mt-6 border-t border-neutral-200 dark:border-neutral-700">
        {items.map((item) => (
          <details key={item.q} className="group border-b border-neutral-200 dark:border-neutral-700">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-4 marker:content-none [&::-webkit-details-marker]:hidden">
              <h3 className="min-w-0 flex-1 text-[1.125rem] font-semibold leading-[1.444] text-neutral-900 lg:text-[1.25rem] lg:leading-7 dark:text-white">
                {item.q}
              </h3>
              <svg
                aria-hidden="true"
                className="size-5 shrink-0 text-neutral-900 dark:text-white"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
              >
                <line x1="5" y1="12" x2="19" y2="12" />
                {/* Vertical stroke: shown closed (+), hidden open (−). */}
                <line x1="12" y1="5" x2="12" y2="19" className="group-open:hidden" />
              </svg>
            </summary>
            <p className="pb-5 pr-10 text-[1.125rem] leading-[1.7] text-neutral-600 dark:text-neutral-300">{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
