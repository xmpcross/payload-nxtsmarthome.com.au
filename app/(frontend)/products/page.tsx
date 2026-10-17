import type { Metadata } from 'next';
import Link from 'next/link';
import JsonLd from '@/components/JsonLd';
import ProductBrowser, { type BrowserCategory, type BrowserProduct } from '@/components/ProductBrowser';
import { AFFILIATE_ENABLED } from '@/lib/affiliate';
import { reviewSummary } from '@/lib/review-sources';
import { FOCUS } from '@/components/category/shared';
import { getAllArticles } from '@/lib/content';
import { guideMentions } from '@/lib/product-mentions';
import { getIndexableTopProducts, getShoppableTopProducts } from '@/lib/products';
import { faqJsonLd, pageAlternates, pageTitle } from '@/lib/seo';
import { categories, site } from '@/lib/site';
import { formatDate } from '@/lib/content';

const TITLE = 'Smart Home Devices for Australian Homes';
const DESCRIPTION =
  // 154 chars, no "Compare" (user request, 6 Oct 2026).
  'Smart home devices sold in Australia — cameras, robot vacuums, lighting, hubs and climate — with links to Amazon AU, JB Hi-Fi, The Good Guys and Bunnings.';

export const metadata: Metadata = {
  // The root template adds the brand; it was also written here, so it appeared twice.
  title: pageTitle(TITLE),
  description: DESCRIPTION,
  alternates: pageAlternates('/products/'),
  /*
    The hub lists price listings; with no indexable product among them it is
    noindex, follow (AdSense Task 2, lib/products.ts isIndexableProduct). The
    catalogue is read at build, so this is decided per deploy.
  */
  ...((await getIndexableTopProducts()).length ? {} : { robots: { index: false, follow: true } }),
  /*
    Without these the page inherits the root object wholesale — including an
    og:url pointing at the homepage — so sharing this page anywhere presented
    it as the front page. Defining openGraph here replaces the root entirely,
    which is why the image has to be repeated.
  */
  openGraph: {
    type: 'website',
    title: TITLE,
    description: DESCRIPTION,
    url: `${site.url}/products/`,
    images: [site.ogImage],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: [site.ogImage],
  },
};

/** Australia-specific failure modes, ordered by how expensive the mistake is. */
const CHECKS: { label: string; body: string; link?: { href: string; label: string } }[] = [
  {
    label: 'Bulb fittings',
    body: 'B22 bayonet fittings are common in Australian homes, especially older ones, while many imported ranges default to E27 screw. Check which one a smart bulb ships with before ordering.',
  },
  {
    label: 'Z-Wave frequency',
    body: 'Australian Z-Wave runs near 921.42 MHz against roughly 908.42 MHz in North America. An imported Z-Wave device will not talk to an Australian hub, and no adaptor fixes it.',
  },
  {
    label: 'Voltage and plugs',
    body: 'Anything sold locally is fine. Imported gear expecting 110V needs more than a plug adaptor.',
  },
  {
    label: 'Warranty',
    body: "When you buy from an Australian business, Australian Consumer Law gives you consumer guarantees alongside the manufacturer's warranty; the ACCC explains what they cover. A grey import can be harder to claim on.",
  },
  {
    label: 'Matter support',
    body: '"Works with Matter" on the box doesn\'t mean every feature is exposed. Check what the specific device actually shares before you rely on it.',
  },
  {
    label: 'Wired work',
    body: 'Fixed wiring — switches, downlights, hardwired sensors — is regulated work that usually needs a licensed electrician. Check your state or territory’s electrical safety regulator.',
    link: {
      href: '/setup-guides/smart-home-electrical-work-australia-legal/',
      label: 'What Electrical Work You Can Legally Do Yourself',
    },
  },
];

/**
 * Answers are kept as plain strings so the same text feeds both the page and
 * the FAQPage schema — a rich result that quotes different words to the ones
 * on screen is worse than no rich result.
 */
const FAQ: { q: string; a: string; link: { href: string; label: string } }[] = [
  {
    q: "Where's the cheapest place to buy smart home gear in Australia?",
    a: 'It depends on the category. Bunnings carries lighting and basic sensors, JB Hi-Fi and The Good Guys stock the mainstream ecosystem devices, and Amazon AU carries the widest range including brands the bricks-and-mortar chains skip. Prices move constantly, so check two before buying.',
    link: { href: '/buying-guides/where-to-buy-smart-home-australia/', label: 'Bunnings vs JB Hi-Fi: Where to Buy' },
  },
  {
    q: 'Do overseas smart home devices work in Australia?',
    a: "Sometimes. Four things decide it: voltage, plug type, radio frequency and app region locking. Wi-Fi devices usually work. Z-Wave devices usually don't, because Australia uses a different frequency band.",
    link: { href: '/buying-guides/overseas-smart-home-devices-australia/', label: 'Do Overseas Devices Work in Australia?' },
  },
  {
    q: 'Do I need a hub?',
    a: 'Not for Wi-Fi devices. Zigbee and Z-Wave devices need a hub, and Thread devices need a border router (often built into a smart speaker or hub). A hub can also keep automations running when your internet drops.',
    link: { href: '/hubs-and-platforms/smart-home-devices-without-internet/', label: 'Do Devices Still Work When the Internet Drops?' },
  },
  {
    q: 'Can renters install this gear?',
    a: 'Most of it, yes. Anything that plugs in, sits on a shelf or mounts with removable adhesive usually needs no permission. Ask your landlord before anything that needs holes or wiring; your state or territory’s tenancy authority explains the rules.',
    link: { href: '/buying-guides/smart-home-for-renters-australia/', label: 'Smart Home for Renters' },
  },
  {
    q: 'Will these devices still work in five years?',
    a: 'The hardware usually outlasts the service behind it. Devices that work locally, without a cloud account, survive longest — which is why Matter and Thread support matter more than any single feature.',
    link: { href: '/buying-guides/future-proof-smart-home-devices-australia/', label: 'Buying Devices That Will Still Work in Five Years' },
  },
];

// The picks come from the articles, which refresh from Strapi every 5 minutes.
export const revalidate = 300;


/** 3D icons in public/images/category-3d/, per category and per buying check. */
const CATEGORY_ICON: Record<string, string> = {
  'security-and-cameras': 'security-camera',
  lighting: 'smart-bulb',
  'energy-and-solar': 'smart-energy',
  'entertainment-and-audio': 'smart-tv',
  'climate-and-comfort': 'smart-thermostat',
  'hubs-and-platforms': 'smart-home-hub',
  'robot-vacuums': 'smart-vacuum-robot',
  'smart-door-locks': 'smart-lock-door',
};
const CHECK_ICON: Record<string, string> = {
  'Bulb fittings': 'smart-bulb',
  'Z-Wave frequency': 'smart-home-hub',
  'Voltage and plugs': 'smart-plug',
  Warranty: 'buying-guides',
  'Matter support': 'setup-guides',
  'Wired work': 'smart-lock-door',
};
const icon = (name: string) => `/images/category-3d/${name}.webp`;

export default async function ProductsPage() {
  // Empty listings are never listed; their pages still resolve (isEmptyListing).
  const products = await getShoppableTopProducts();
  const mentions = guideMentions(await getAllArticles());

  // Slim rows for the client browser (never whole products: see ProductBrowser).
  const rows: BrowserProduct[] = products.map((p) => {
    const priced = (p.retailers || [])
      .filter((r) => typeof r.priceAud === 'number')
      .sort((a, b) => (a.priceAud as number) - (b.priceAud as number));
    return {
      slug: p.slug,
      name: p.brand && !p.name.toLowerCase().startsWith(p.brand.toLowerCase()) ? `${p.brand} ${p.name}` : p.name,
      brand: p.brand || undefined,
      category: p.categoryName ?? '',
      categorySlug: p.categorySlug ?? '',
      image: p.image || undefined,
      bestFor: p.bestFor || undefined,
      low: priced.length ? (priced[0].priceAud as number) : null,
      lowAt: priced.length ? priced[0].name : null,
      // Every retailer selling it; the price shown is the lowest known one.
      retailers: [...new Set((p.retailers || []).map((r) => r.name))],
      guide: mentions.get(p.slug)?.[0]?.title ?? null,
      ...(() => { const s = reviewSummary(p); return { rating: s.rating, reviewCount: s.reviewCount }; })(),
    };
  });
  const browserCategories: BrowserCategory[] = categories
    .map((c) => ({ slug: c.slug, name: c.name, count: rows.filter((r) => r.categorySlug === c.slug).length, icon: icon(CATEGORY_ICON[c.slug] ?? 'smart-home-hub') }))
    .filter((c) => c.count > 0);
  const retailers = [...new Set(rows.flatMap((r) => r.retailers))].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));
  const checked = products
    .map((p) => (p as { pricesCheckedAt?: string }).pricesCheckedAt)
    .filter((d): d is string => Boolean(d))
    .sort()
    .pop();

  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: `${site.url}/` },
            { '@type': 'ListItem', position: 2, name: 'Products', item: `${site.url}/products/` },
          ],
        }}
      />
      <JsonLd data={faqJsonLd(FAQ.map(({ q, a }) => ({ q, a })))} />
      <header className="container pt-7 lg:pt-9">
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs font-semibold text-neutral-600 dark:text-neutral-400">
          <Link href="/" className={`hover:text-neutral-900 dark:hover:text-white ${FOCUS}`}>
            Home
          </Link>
          <span aria-hidden="true">/</span>
          <span className="text-neutral-900 dark:text-white" aria-current="page">
            Products
          </span>
        </nav>
        <h1 className="mt-4 leading-tight font-bold tracking-tight text-balance text-neutral-900 dark:text-white">
          Smart home devices for Australian homes
        </h1>
        <p className="mt-3 max-w-[72ch] text-neutral-700 dark:text-neutral-300">
          Devices sold by Australian retailers, each with a short note on who it suits and the lowest price we last saw. Prices
          change, so check the retailer before you buy.
        </p>
        <p className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-neutral-600 dark:text-neutral-400">
          <span><b className="font-semibold text-neutral-900 tabular-nums dark:text-white">{rows.length}</b> devices</span>
          <span><b className="font-semibold text-neutral-900 tabular-nums dark:text-white">{browserCategories.length}</b> categories</span>
          <span><b className="font-semibold text-neutral-900 tabular-nums dark:text-white">{retailers.length}</b> Australian retailers</span>
          {checked ? (
            <span>Prices last checked <b className="font-semibold text-neutral-900 dark:text-white">{formatDate(checked)}</b></span>
          ) : null}
          <span className="inline-flex items-center gap-2 text-neutral-700 dark:text-neutral-300">
            <span aria-hidden="true" className="size-2 rounded-[50%] bg-primary-600 dark:bg-primary-400" />
            Listings, not reviews: we have not tested these products.
          </span>
        </p>
      </header>

      <main className="container pb-20 lg:pb-28">
        <h2 className="sr-only">Every device</h2>
        <ProductBrowser products={rows} categories={browserCategories} retailers={retailers} />

        <section aria-labelledby="checks-heading" className="mt-16 lg:mt-20">
          <h2 id="checks-heading" className="text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl dark:text-white">
            Before you buy in Australia
          </h2>
          <p className="mt-1.5 max-w-[68ch] text-neutral-600 dark:text-neutral-400">
            Six things that catch people out, ordered by how expensive the mistake is.
          </p>
          <div className="mt-6 grid gap-3.5 md:grid-cols-2 lg:grid-cols-3">
            {CHECKS.map((check) => (
              <div
                key={check.label}
                className="grid grid-cols-[48px_minmax(0,1fr)] gap-3.5 rounded-lg border border-neutral-200 bg-white p-4.5 dark:border-[#313131] dark:bg-[#222324]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={icon(CHECK_ICON[check.label] ?? 'smart-home-hub')} alt="" width={48} height={48} loading="lazy" className="size-12" />
                <div className="min-w-0">
                  <h3 className="font-semibold text-neutral-900 dark:text-white">{check.label}</h3>
                  <p className="mt-0.5 text-sm text-neutral-700 dark:text-neutral-300">
                    {check.body}
                    {check.link ? (
                      <>
                        {' '}
                        <Link href={check.link.href} className={`font-semibold text-primary-600 underline underline-offset-4 dark:text-primary-400 ${FOCUS}`}>
                          {check.link.label}
                        </Link>
                      </>
                    ) : null}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="faq-heading" className="mt-16 lg:mt-20">
          <h2 id="faq-heading" className="text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl dark:text-white">
            Common questions
          </h2>
          <div className="mt-5 border-t border-neutral-200 dark:border-neutral-800">
            {FAQ.map((item) => (
              <details key={item.q} className="group border-b border-neutral-200 dark:border-neutral-800">
                <summary
                  className={`flex cursor-pointer list-none items-start justify-between gap-4 py-4 font-semibold text-neutral-900 dark:text-white [&::-webkit-details-marker]:hidden ${FOCUS}`}
                >
                  {item.q}
                  <span aria-hidden="true" className="text-xl leading-none text-primary-600 group-open:hidden dark:text-primary-400">+</span>
                  <span aria-hidden="true" className="hidden text-xl leading-none text-primary-600 group-open:inline dark:text-primary-400">–</span>
                </summary>
                <div className="max-w-[75ch] pb-5 text-neutral-700 dark:text-neutral-300">
                  <p>
                    {item.a}{' '}
                    <Link href={item.link.href} className={`font-semibold text-primary-600 underline underline-offset-4 dark:text-primary-400 ${FOCUS}`}>
                      {item.link.label}
                    </Link>
                  </p>
                </div>
              </details>
            ))}
          </div>
        </section>

        <p id="how-listed" className="mt-14 rounded-lg bg-primary-50 p-5 text-sm text-neutral-700 dark:bg-primary-500/10 dark:text-neutral-300">
          <b className="font-semibold text-neutral-900 dark:text-white">How these products are listed.</b> We list devices sold
          in Australia by a retailer with local warranty support, with the lowest price from our last check. These are
          listings, not reviews: we have not tested these products. Devices our guides discuss are marked and can be shown
          first. No retailer or brand pays to be listed or for its position.
          {AFFILIATE_ENABLED ? ' Some links earn us a commission at no extra cost to you, which does not affect what appears here or its order.' : ''}{' '}
          Read{' '}
          <Link href="/how-we-test/" className={`font-semibold text-primary-600 underline underline-offset-4 dark:text-primary-400 ${FOCUS}`}>
            how we research
          </Link>{' '}
          and our{' '}
          <Link href="/affiliate-disclosure/" className={`font-semibold text-primary-600 underline underline-offset-4 dark:text-primary-400 ${FOCUS}`}>
            affiliate disclosure
          </Link>
          .
        </p>
      </main>
    </>
  );
}
