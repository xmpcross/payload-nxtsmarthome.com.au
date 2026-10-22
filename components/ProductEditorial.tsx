import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import type { Product } from '@/lib/products';
import { affiliateHtmlLinks } from '@/lib/affiliate';

/**
 * The curated editorial for a product (Payload Editorial fields, originally
 * content/products/<slug>.md), shown as two product tabs in ProductAccordion
 * (user request, 17 Oct 2026): "Our Research Notes" and "Sources". The note's
 * "## Sources" section is split out into the second tab. Server-rendered.
 *
 * Only curated products have it, and they are the only product pages that can
 * be indexable (lib/products.ts isIndexableProduct): this is the original
 * writing that rule counts. Accordion panels stay in the served HTML when
 * closed, so it is still on the page for crawlers.
 *
 * Says plainly what it is: research, not a test (CLAUDE.md rule 5). There is
 * no rating anywhere in it.
 */
async function markdownToHtml(md: string): Promise<string> {
  const file = await unified().use(remarkParse).use(remarkGfm).use(remarkRehype).use(rehypeStringify).process(md);
  // Source links leave the site: open them in a new tab, no referrer.
  // Amazon/eBay links then go through Geniuslink, with the buy-button rel.
  return affiliateHtmlLinks(
    String(file).replace(/<a href="(https?:\/\/[^"]+)">/g, '<a href="$1" target="_blank" rel="noopener noreferrer nofollow">'),
  );
}

const PROSE =
  'prose prose-sm max-w-none leading-relaxed text-[#55555a] dark:prose-invert dark:text-slate-300 prose-h2:mt-6 prose-h2:text-lg prose-a:break-all';

/** The note split at its "## Sources" heading, each half rendered to HTML. */
export async function editorialParts(product: Product): Promise<{ notesHtml: string; sourcesHtml: string; hasNotes: boolean }> {
  const note = (product.note ?? '').replace(/<!--[\s\S]*?-->/g, '').trim();
  const at = note.search(/^#{2,3}\s+Sources\b.*$/im);
  const notes = (at === -1 ? note : note.slice(0, at)).trim();
  const sources = at === -1 ? '' : note.slice(at).replace(/^#{2,3}\s+Sources\b.*$/im, '').trim();
  return {
    notesHtml: notes ? await markdownToHtml(notes) : '',
    sourcesHtml: sources ? await markdownToHtml(sources) : '',
    hasNotes: Boolean(notes || product.bestFor || product.pros?.length || product.cons?.length),
  };
}

/** "Our Research Notes" tab body: disclaimer, best for, pros/cons, notes. */
export function ProductResearchNotes({ product, html }: { product: Product; html: string }) {
  return (
    <div>
      <p className="text-sm text-[#55555a] dark:text-slate-400">
        Research-based: compiled from the manufacturer&apos;s information and Australian retailer
        listings. NXT Smart Home has not tested this product.
      </p>

      {product.bestFor ? (
        <p className="mt-4 text-[15px] text-[#1d252c] dark:text-slate-100">
          <span className="font-bold">Best for:</span> {product.bestFor}
        </p>
      ) : null}

      {product.pros?.length || product.cons?.length ? (
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          {product.pros?.length ? (
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-[#318000] dark:text-emerald-400">Pros</h3>
              <ul className="mt-2 space-y-1.5">
                {product.pros.map((pro) => (
                  <li key={pro} className="flex gap-2 text-sm leading-relaxed text-[#1d252c] dark:text-slate-200">
                    <span className="text-[#318000] dark:text-emerald-400" aria-hidden="true">+</span>
                    <span>{pro}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {product.cons?.length ? (
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-[#b42318] dark:text-rose-400">Cons</h3>
              <ul className="mt-2 space-y-1.5">
                {product.cons.map((con) => (
                  <li key={con} className="flex gap-2 text-sm leading-relaxed text-[#1d252c] dark:text-slate-200">
                    <span className="text-[#b42318] dark:text-rose-400" aria-hidden="true">−</span>
                    <span>{con}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {html ? <div className={`${PROSE} mt-6`} dangerouslySetInnerHTML={{ __html: html }} /> : null}
    </div>
  );
}

/** "Sources" tab body: the note's source list. */
export function ProductSources({ html }: { html: string }) {
  return <div className={PROSE} dangerouslySetInnerHTML={{ __html: html }} />;
}
