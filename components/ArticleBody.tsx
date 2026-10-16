import ProductBox from './ProductBox';
import type { Product } from '@/lib/products';

/**
 * Renders the article HTML, replacing inline product markers with real ProductBoxes.
 *
 * scripts/link-products.mjs writes a marker into the markdown at the end of the
 * section that discusses a product:
 *
 *     ::product:aqara-hub-m3::
 *
 * which the markdown pipeline turns into `<p>::product:aqara-hub-m3::</p>`. The
 * HTML is split on those paragraphs and the segments are interleaved with the
 * component, so the buy box lands next to the prose instead of in a block at the
 * bottom of the page.
 *
 * A marker whose product no longer exists renders nothing rather than leaking the
 * raw token onto the page.
 */

const MARKER = /<p>::product:([a-z0-9-]+)::<\/p>/g;

interface Props {
  html: string;
  products: Product[];
  /** Article slug — becomes the affiliate subID. */
  subId: string;
  className?: string;
  /**
   * Rendered roughly halfway down the article, at the nearest paragraph boundary.
   * Splitting on a closing </p> rather than a character offset means the insert
   * never lands inside a heading, list, table or product box.
   */
  midSlot?: React.ReactNode;
}

export default function ArticleBody({ html, products, subId, className, midSlot }: Props) {
  const bySlug = new Map(products.map((p) => [p.slug, p]));

  const parts: Array<{ type: 'html'; value: string } | { type: 'product'; slug: string }> = [];
  let lastIndex = 0;
  let m: RegExpExecArray | null;

  MARKER.lastIndex = 0;
  while ((m = MARKER.exec(html)) !== null) {
    if (m.index > lastIndex) {
      parts.push({ type: 'html', value: html.slice(lastIndex, m.index) });
    }
    parts.push({ type: 'product', slug: m[1] });
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < html.length) {
    parts.push({ type: 'html', value: html.slice(lastIndex) });
  }

  // Rank only counts products actually rendered inline.
  let rank = 0;
  const inlineCount = parts.filter(
    (p) => p.type === 'product' && bySlug.has((p as { slug: string }).slug),
  ).length;

  /*
   * Work out where the mid-article slot goes: the paragraph boundary closest to
   * the halfway point by character count. Splitting on </p> rather than a raw
   * offset guarantees it never lands inside a heading, list, table or product box.
   */
  const total = parts.reduce((n, part) => n + (part.type === 'html' ? part.value.length : 0), 0);
  let seen = 0;
  let slotAt: { index: number; offset: number } | null = null;
  if (midSlot && total > 0) {
    for (let i = 0; i < parts.length && !slotAt; i += 1) {
      const part = parts[i];
      if (part.type !== 'html') continue;
      if (seen + part.value.length >= total / 2) {
        const want = total / 2 - seen;
        let best = -1;
        let dist = Infinity;
        let at = part.value.indexOf('</p>');
        while (at !== -1) {
          const end = at + 4;
          if (Math.abs(end - want) < dist) {
            dist = Math.abs(end - want);
            best = end;
          }
          at = part.value.indexOf('</p>', at + 1);
        }
        // Only split if a boundary exists and it is not right at either end.
        if (best > 0 && best < part.value.length) slotAt = { index: i, offset: best };
      }
      seen += part.value.length;
    }
  }

  // Ncmaz single-post typography (neutral prose, primary links).
  // prose-lg sets the heading and spacing scale at all breakpoints; body
  // paragraphs and lists are held at 1rem by globals.css.
  const PROSE =
    'prose prose-lg prose-neutral max-w-none prose-headings:scroll-mt-24 prose-headings:font-semibold prose-h2:mt-0 prose-h2:mb-0 prose-h3:mt-5 prose-h3:mb-2 prose-table:text-[14px] prose-a:text-primary-600 prose-a:font-medium hover:prose-a:text-primary-700 prose-img:rounded-2xl prose-th:text-left dark:prose-invert dark:prose-a:text-primary-400';

  return (
    <div className={className}>
      {parts.map((part, i) => {
        if (part.type === 'html') {
          if (slotAt && slotAt.index === i) {
            return (
              <div key={`h-${i}`}>
                <div className={PROSE} dangerouslySetInnerHTML={{ __html: part.value.slice(0, slotAt.offset) }} />
                <div>{midSlot}</div>
                <div className={PROSE} dangerouslySetInnerHTML={{ __html: part.value.slice(slotAt.offset) }} />
              </div>
            );
          }
          return (
            <div
              key={`h-${i}`}
              // The article container is 1296px wide, but body copy is capped at a
              // readable measure. Running prose the full width would give ~180
              // characters per line; comfortable reading is roughly 65-80.
              className={PROSE}
              dangerouslySetInnerHTML={{ __html: part.value }}
            />
          );
        }
        const product = bySlug.get(part.slug);
        if (!product) return null;
        rank += 1;
        return (
          <ProductBox
            key={`p-${part.slug}-${i}`}
            product={product}
            subId={subId}
            rank={inlineCount > 1 ? rank : undefined}
          />
        );
      })}
    </div>
  );
}
