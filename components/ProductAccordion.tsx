'use client';

import { useEffect, useId, useState } from 'react';
import Link from 'next/link';
import { AFFILIATE_ENABLED } from '@/lib/affiliate';
import { bulletsOf } from '@/lib/bullets';
import { featureItems, isFeatureSpec } from '@/lib/feature-specs';
import { splitDescriptionFaqs } from '@/lib/description-faq';
import DescriptionFaqs from '@/components/DescriptionFaqs';
import type { TopProduct } from '@/lib/products';

/**
 * Product detail panels, matching the nxt.deals PDP: stacked accordion sections
 * inside a single white card, first section open by default.
 *
 * Specifications and Additional Info open in an off-canvas "side peek", as the
 * reference does. Description and Features stay inline.
 *
 * The objection that used to sit here — that a side peek hides content a static
 * export needs crawlable — is answered by never unmounting the panel. Its markup
 * is rendered into the served HTML exactly as before; opening it only changes
 * the CSS that positions it. A crawler reads the specifications whether or not
 * anyone clicks, which is the same bargain the collapsed accordion already made.
 *
 * Deliberately not a portal. createPortal has no DOM to target during a static
 * export, so a portalled panel would be absent from the HTML entirely — which is
 * the very thing this is avoiding.
 */

type SectionKey = 'description' | 'research' | 'specifications' | 'additional' | 'sources';

/** The two the reference puts off-canvas. The rest stay in the page. */
const PEEK: ReadonlySet<SectionKey> = new Set(['specifications', 'additional']);

function Chevron({ open }: { open: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`ml-auto text-xl leading-none text-[#55555a] transition-transform duration-200 dark:text-slate-400 ${
        open ? 'rotate-90' : ''
      }`}
    >
      ›
    </span>
  );
}

/* Points right rather than down: these two open a panel from the side, and a
   down-chevron would promise an accordion that expands in place. */
function PeekArrow() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="ml-auto h-5 w-5 shrink-0 text-[#55555a] dark:text-slate-400"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="9 6 15 12 9 18" />
    </svg>
  );
}

function SpecRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <>
      <dt className="border-b border-[#e0e0e0] py-1.5 text-sm font-semibold text-[#1d252c] dark:border-slate-700 dark:text-slate-200">
        {label}
      </dt>
      <dd className="border-b border-[#e0e0e0] py-1.5 text-sm text-[#55555a] dark:border-slate-700 dark:text-slate-300">
        {value}
      </dd>
    </>
  );
}

/** Wide label column, value alongside, hairline rule under each row. */
function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-b border-[#e8e8e8] py-3.5 last:border-0 dark:border-slate-700/70 sm:flex-row sm:gap-6">
      <dt className="w-full font-bold text-[#1d252c] dark:text-white sm:w-52 sm:shrink-0">
        {label}
      </dt>
      <dd className="min-w-0 wrap-break-word text-[#55555a] dark:text-slate-300">{value}</dd>
    </div>
  );
}

export default function ProductAccordion({
  product,
  researchNotes,
  sources,
}: {
  product: TopProduct;
  /** "Our Research Notes" tab, server-rendered (components/ProductEditorial.tsx). */
  researchNotes?: React.ReactNode;
  /** "Sources" tab, the note's source list (components/ProductEditorial.tsx). */
  sources?: React.ReactNode;
}) {
  const [open, setOpen] = useState<SectionKey | null>('description');
  const baseId = useId();

  const retailerNames = (product.retailers || []).map((r) => r.name);
  // The description's FAQ section is lifted out of the Description panel and
  // shown under the last row (Additional Info) instead (user request, 24 Sep 2026).
  const descriptionFaqs = product.cmsDescriptionHtml ? splitDescriptionFaqs(product.cmsDescriptionHtml).faqs : [];

  /*
   * Manufacturer specs carry the page. Only two derived rows are worth keeping
   * alongside them — brand and model — because they name the thing being
   * specced. Category, product type, SKU and dates belong to Additional Info,
   * and the seeded `priceAud` is deliberately absent: it came from the original
   * generator and is not a real RRP, so the verified retailer prices in the
   * sidebar are the only prices this page states.
   */
  const specs: Array<{ label: string; value: React.ReactNode }> = [];
  if (product.brand) specs.push({ label: 'Brand', value: product.brand });
  specs.push({ label: 'Model', value: product.name });
  // No "Rating" row: the catalogue figure pools reviews from storefronts
  // worldwide, and in a spec table it reads as our score. Retailer customer
  // reviews, labelled as theirs, are in the reviews block.

  const updated = product.updatedAt
    ? new Date(product.updatedAt).toLocaleDateString('en-AU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;

  const allSpecs = product.specifications || [];
  // Feature-type specs are listed under their own "Features" heading below the
  // specification table, not as table rows (user request, 24 Sep 2026).
  const detailSpecs = allSpecs.filter((s) => !isFeatureSpec(s.name));
  const featureSpecs = allSpecs.filter((s) => isFeatureSpec(s.name));

  /* Escape closes an open peek. A slide-over covering the page with no keyboard
     way out is a trap for anyone not using a mouse. */
  useEffect(() => {
    if (!open || !PEEK.has(open)) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const sections: Array<{ key: SectionKey; title: string; body: React.ReactNode }> = [
    {
      key: 'description',
      title: 'Description',
      body: (
        <>
          {/*
            The blurb written in the CMS wins. It is the copy someone edited for
            this product, and it is what "About this product" shows above — the
            two disagreeing on one page is what made a rewrite look like it had
            not applied.

            The manufacturer's description is the fallback for anything not
            rewritten yet, and the generated sentence below that for products the
            feed returned no description for; it states nothing beyond what the
            record already holds.
          */}
          {product.cmsDescriptionHtml ? (
            /*
              The CMS long description, written as markdown and converted at
              build time. This panel is the place for it: "About this product"
              above carries the short bulleted blurb, and printing the same few
              lines twice on one page told a reader nothing new.

              prose-sm gives the headings and paragraphs inside it spacing —
              the markup arrives as real HTML, not text.
            */
            <DescriptionWithFaqs
              html={product.cmsDescriptionHtml}
              verdict={product.bestFor ? <Verdict text={product.bestFor} /> : null}
            />
          ) : product.shortDescription && bulletsOf(product.shortDescription).length > 1 ? (
            /* Bulleted copy becomes a real list — as a paragraph the "•"
               characters print as text. */
            <ul className="space-y-2 leading-relaxed text-[#55555a] dark:text-slate-300">
              {bulletsOf(product.shortDescription).map((line) => (
                <li key={line} className="flex gap-2.5">
                  <span
                    aria-hidden="true"
                    className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#55555a] dark:bg-slate-400"
                  />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          ) : product.shortDescription || product.description ? (
            <p className="whitespace-pre-line leading-relaxed text-[#55555a] dark:text-slate-300">
              {product.shortDescription || product.description}
            </p>
          ) : (
            <p className="leading-relaxed text-[#55555a] dark:text-slate-300">
              The {product.brand ? `${product.brand} ` : ''}
              {product.name} sits in our {product.categoryName} category
              {product.subCategory ? ` under ${product.subCategory}` : ''}, and is sold in
              Australia through{' '}
              {retailerNames.length === 1
                ? retailerNames[0]
                : `${retailerNames.length} retailers including ${retailerNames.slice(0, 3).join(', ')}`}
              . Australian stock levels and pricing move independently of overseas listings, so
              confirm the current price with the retailer before you buy.
            </p>
          )}

          {/* With a CMS description the verdict closes it (DescriptionWithFaqs);
              without one it closes the panel here. */}
          {product.bestFor && !product.cmsDescriptionHtml ? <Verdict text={product.bestFor} /> : null}
        </>
      ),
    },
    // No Features section: its content is shown under Highlights instead
    // (user request, 24 Sep 2026).
    ...(researchNotes ? [{ key: 'research' as const, title: 'Our Research Notes', body: researchNotes }] : []),
    {
      key: 'specifications',
      title: 'Specifications',
      body: (
        <>
          <dl className="grid grid-cols-[minmax(8rem,12rem)_minmax(0,1fr)] gap-x-5 gap-y-2">
            {specs.map((spec) => (
              <SpecRow key={spec.label} label={spec.label} value={spec.value} />
            ))}
            {/* Manufacturer specifications from the Google Shopping catalogue.
                Feature-style entries are listed under Features, below. */}
            {detailSpecs.map((spec) => (
              <SpecRow key={`mfr-${spec.name}`} label={spec.name} value={spec.value} />
            ))}
          </dl>

          {featureSpecs.length ? (
            <div className="mt-6">
              <h3 className="mb-3 text-base font-bold text-[#1d252c] dark:text-white">Features</h3>
              <ul className="space-y-4">
                {featureSpecs.map((spec) => {
                  const items = featureItems(spec.value);
                  return (
                    <li key={spec.name}>
                      <h4 className="text-sm font-bold text-[#1d252c] dark:text-white">{spec.name}</h4>
                      {items.length > 1 ? (
                        <ul className="mt-1.5 space-y-1">
                          {items.map((item) => (
                            <li key={item} className="flex gap-2 text-sm text-[#55555a] dark:text-slate-300">
                              <span className="text-primary-600" aria-hidden="true">✓</span>
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-1 text-sm text-[#55555a] dark:text-slate-300">{spec.value}</p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

          {detailSpecs.length ? (
            <p className="mt-4 text-xs text-[#55555a] dark:text-slate-400">
              Specifications are sourced from the manufacturer listing. Confirm details on the
              retailer&apos;s product page before purchasing.
            </p>
          ) : (
            <p className="mt-4 text-xs text-[#55555a] dark:text-slate-400">
              Detailed hardware specifications are not published for this listing. Check the
              retailer&apos;s product page for dimensions, power requirements and connectivity
              before purchasing.
            </p>
          )}
        </>
      ),
    },
    {
      key: 'additional',
      title: 'Additional Info',
      body: (
        <>
          {/*
            Identifier sheet. GTIN and MPN render only when the catalogue
            actually supplies them — Google returns both as null for every
            product here, and a fabricated barcode is worse than a missing row.
          */}
          <dl className="text-sm">
            {product.brand ? <InfoRow label="Brand" value={product.brand} /> : null}
            {product.categoryName ? (
              <InfoRow
                label="Category"
                value={
                  <Link
                    href={`/products/category/${product.categorySlug}/`}
                    className="hover:text-[#0046be] hover:underline dark:hover:text-blue-400"
                  >
                    {product.categoryName}
                  </Link>
                }
              />
            ) : null}
            {product.subCategory ? (
              <InfoRow label="Product type" value={product.subCategory} />
            ) : null}
            <InfoRow label="SKU" value={product.id || product.slug} />
            {product.googleProductId ? (
              <InfoRow label="Catalogue ID" value={product.googleProductId} />
            ) : null}
            {product.gtin ? <InfoRow label="GTIN" value={product.gtin} /> : null}
            {product.mpn ? <InfoRow label="MPN" value={product.mpn} /> : null}
            {updated ? <InfoRow label="Last Updated" value={updated} /> : null}
          </dl>

          <p className="mt-4 text-xs text-[#55555a] dark:text-slate-400">
            Prices are indicative and in Australian dollars — confirm on the retailer&apos;s site.
            {AFFILIATE_ENABLED && (
              <>
                We may earn a commission from links on this page, at no extra cost to you.{' '}
                <Link href="/affiliate-disclosure/" className="text-[#0046be] underline dark:text-blue-400">
                  Read our full disclosure
                </Link>
                .
              </>
            )}
          </p>
        </>
      ),
    },
    ...(sources ? [{ key: 'sources' as const, title: 'Sources', body: sources }] : []),
  ];

  return (
    <div className="rounded-[8px] bg-white px-5 pb-4 pt-2 dark:bg-slate-800">
      {sections.map((section, i) => {
        const isOpen = open === section.key;
        const peeks = PEEK.has(section.key);
        return (
          <div
            key={section.key}
            className={i === 0 ? '' : 'border-t border-[#e0e0e0] dark:border-slate-700'}
          >
            <h2>
              <button
                type="button"
                id={`${baseId}-h-${section.key}`}
                aria-expanded={isOpen}
                aria-controls={`${baseId}-p-${section.key}`}
                aria-haspopup={peeks ? 'dialog' : undefined}
                onClick={() => setOpen(isOpen ? null : section.key)}
                className="flex w-full items-center py-4 text-left text-base font-bold text-[#1d252c] dark:text-white"
              >
                {section.title}
                {peeks ? <PeekArrow /> : <Chevron open={isOpen} />}
              </button>
            </h2>
            {/*
              Panels stay in the DOM and collapse with CSS. This is a static
              export — a conditionally rendered panel never reaches the served
              HTML, so no crawler would ever see the specifications.
            */}
            {peeks ? (
              <>
                {/* Scrim rendered always, transparent and click-through when
                    shut, so opening inserts no node and shifts nothing. */}
                <div
                  aria-hidden={!isOpen}
                  onClick={() => setOpen(null)}
                  className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-200 ${
                    isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
                  }`}
                />
                <div
                  id={`${baseId}-p-${section.key}`}
                  role="dialog"
                  aria-modal="false"
                  aria-labelledby={`${baseId}-h-${section.key}`}
                  className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-white shadow-2xl transition-transform duration-300 ease-out dark:bg-slate-800 ${
                    isOpen ? 'translate-x-0' : 'pointer-events-none translate-x-full'
                  }`}
                >
                  <div className="flex items-center justify-between border-b border-[#e0e0e0] px-5 py-4 dark:border-slate-700">
                    <span className="text-base font-bold text-[#1d252c] dark:text-white">
                      {section.title}
                    </span>
                    <button
                      type="button"
                      onClick={() => setOpen(null)}
                      aria-label={`Close ${section.title}`}
                      className="rounded-sm p-1 text-[#55555a] transition hover:bg-slate-100 hover:text-[#1d252c] dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white"
                    >
                      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <line x1="6" y1="6" x2="18" y2="18" />
                        <line x1="18" y1="6" x2="6" y2="18" />
                      </svg>
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto px-5 py-5">{section.body}</div>
                </div>
              </>
            ) : (
              <div
                id={`${baseId}-p-${section.key}`}
                role="region"
                aria-labelledby={`${baseId}-h-${section.key}`}
                className={isOpen ? 'pb-5' : 'hidden'}
              >
                {section.body}
              </div>
            )}
          </div>
        );
      })}

      <DescriptionFaqs items={descriptionFaqs} />
    </div>
  );
}

/**
 * The CMS description without its "FAQs" section, which ProductAccordion shows
 * under the Additional Info row as an accordion (components/DescriptionFaqs.tsx).
 * Text before and after the FAQ section renders as before, then the verdict.
 */
const proseClass =
  'prose prose-sm max-w-none leading-relaxed text-[#55555a] dark:prose-invert dark:text-slate-300';

function DescriptionWithFaqs({ html, verdict }: { html: string; verdict?: React.ReactNode }) {
  const { before, after } = splitDescriptionFaqs(html);
  return (
    <>
      <div className={proseClass} dangerouslySetInnerHTML={{ __html: before }} />
      {/* Verdict closes the description; the FAQs render under Additional Info. */}
      {verdict}
      {after ? <div className={`${proseClass} mt-6`} dangerouslySetInnerHTML={{ __html: after }} /> : null}
    </>
  );
}

/**
 * "Our verdict": the product's bestFor line as a card, brand accent on the
 * left, a small label over the line itself.
 */
function Verdict({ text }: { text: string }) {
  return (
    <aside
      aria-label="Our verdict"
      className="mt-6 flex gap-3.5 rounded-lg border border-primary-200 border-l-4 border-l-primary-600 bg-primary-50/70 p-4 dark:border-primary-500/30 dark:border-l-primary-400 dark:bg-primary-500/10"
    >
      <span
        aria-hidden="true"
        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-600 text-white dark:bg-primary-500"
      >
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12.5 10 17 19 7.5" />
        </svg>
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-bold tracking-wider text-primary-700 uppercase dark:text-primary-300">Our verdict</p>
        <p className="mt-1 text-[15px] leading-relaxed font-semibold text-[#1d252c] dark:text-white">{text}</p>
      </div>
    </aside>
  );
}
