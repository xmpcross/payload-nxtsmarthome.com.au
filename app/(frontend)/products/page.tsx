import type { Metadata } from 'next';
import Link from 'next/link';
import JsonLd from '@/components/JsonLd';
import ProductCatalogue from '@/components/products/ProductCatalogue';
import { toCatalogueItem } from '@/components/products/catalogue-item';
import ProductPick from '@/components/products/ProductPick';
import { FOCUS } from '@/components/category/shared';
import { getAllArticles } from '@/lib/content';
import { guideMentions } from '@/lib/product-mentions';
import { getIndexableTopProducts, getShoppableTopProducts } from '@/lib/products';
import { faqJsonLd, pageAlternates, pageTitle } from '@/lib/seo';
import { categories, site } from '@/lib/site';

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

const PICKS_PER_CATEGORY = 3;

export default async function ProductsPage() {
  // Empty listings are never listed; their pages still resolve (isEmptyListing).
  const products = (await getShoppableTopProducts());
  const mentions = guideMentions(await getAllArticles());

  // Per category: the listed products our guides discuss, most-discussed first.
  const picks = categories
    .map((category) => ({
      category,
      count: products.filter((p) => p.categorySlug === category.slug).length,
      items: products
        .filter((p) => p.categorySlug === category.slug && mentions.has(p.slug))
        .sort((a, b) => (mentions.get(b.slug)!.length - mentions.get(a.slug)!.length) || a.name.localeCompare(b.name))
        .slice(0, PICKS_PER_CATEGORY),
    }))
    .filter((group) => group.items.length > 0);

  const items = [...products].sort((a, b) => a.name.localeCompare(b.name)).map((p) => toCatalogueItem(p, 'category'));
  const groups = categories.map((c) => ({ key: c.slug, label: c.name }));
  const categoryCount = new Set(products.map((p) => p.categorySlug)).size;

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

      <header className="container pt-8 lg:pt-12">
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs font-semibold text-neutral-600 dark:text-neutral-400">
          <Link href="/" className={`hover:text-neutral-900 dark:hover:text-white ${FOCUS}`}>
            Home
          </Link>
          <span aria-hidden="true">/</span>
          <span className="text-neutral-900 dark:text-white" aria-current="page">
            Products
          </span>
        </nav>
        <h1 className="mt-6 text-4xl font-black tracking-tight text-balance text-neutral-900 sm:text-5xl dark:text-white">
          Smart home devices for Australian homes
        </h1>
        <p className="mt-5 max-w-[68ch] text-base leading-relaxed text-pretty text-neutral-700 sm:text-lg dark:text-neutral-300">
          Devices sold by Australian retailers, each with a short note on who it suits. We start with the ones our guides
          discuss, then list everything. Prices change daily, so we send you to the retailer to check the current one.
          These are listings, not reviews: we have not tested these products.
        </p>
        <p className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm text-neutral-600 dark:text-neutral-400">
          <span>
            <span className="tabular-nums font-semibold text-neutral-900 dark:text-white">{products.length}</span> devices in{' '}
            <span className="tabular-nums">{categoryCount}</span> categories
          </span>
          <a href="#how-listed" className={`font-semibold text-primary-600 underline underline-offset-4 dark:text-primary-400 ${FOCUS}`}>
            How these are listed
          </a>
        </p>
      </header>

      <main className="container pt-12 pb-20 lg:pt-14 lg:pb-28">
        {picks.length ? (
          <section aria-labelledby="picks-heading">
            <h2 id="picks-heading" className="text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl dark:text-white">
              Discussed in our guides
            </h2>
            <p className="mt-2 max-w-[68ch] text-neutral-700 dark:text-neutral-300">
              Devices that come up in our buying and setup guides, by category, with the guide that covers them.
            </p>
            <div className="mt-10 space-y-14">
              {picks.map(({ category, count, items: groupItems }) => (
                <section key={category.slug} aria-labelledby={`picks-${category.slug}`}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                    <h3 id={`picks-${category.slug}`} className="text-xl font-bold text-neutral-900 dark:text-white">
                      {category.name}
                    </h3>
                    <Link
                      href={`/products/category/${category.slug}/`}
                      className={`text-sm font-semibold text-primary-600 underline underline-offset-4 dark:text-primary-400 ${FOCUS}`}
                    >
                      All {count} {category.name} devices
                    </Link>
                  </div>
                  <div className="mt-4 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
                    {groupItems.map((product) => (
                      <ProductPick key={product.slug} product={product} guide={mentions.get(product.slug)?.[0]} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </section>
        ) : null}

        <section aria-labelledby="every-heading" className="mt-20 lg:mt-24">
          <h2 id="every-heading" className="mb-5 text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl dark:text-white">
            Every device
          </h2>
          <ProductCatalogue items={items} groups={groups} groupName="Category" />
        </section>

        <section aria-labelledby="checks-heading" className="mt-20 lg:mt-24">
          <h2 id="checks-heading" className="text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl dark:text-white">
            Before you buy in Australia
          </h2>
          <dl className="mt-6 grid gap-x-10 border-t border-neutral-200 lg:grid-cols-2 dark:border-neutral-800">
            {CHECKS.map((check) => (
              <div key={check.label} className="border-b border-neutral-200 py-5 dark:border-neutral-800">
                <dt className="font-semibold text-neutral-900 dark:text-white">{check.label}</dt>
                <dd className="mt-1.5 leading-relaxed text-neutral-700 dark:text-neutral-300">
                  {check.body}
                  {check.link ? (
                    <>
                      {' '}
                      <Link
                        href={check.link.href}
                        className={`font-semibold text-primary-600 underline underline-offset-4 dark:text-primary-400 ${FOCUS}`}
                      >
                        {check.link.label}
                      </Link>
                    </>
                  ) : null}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="faq-heading" className="mt-20 max-w-[68ch] lg:mt-24">
          <h2 id="faq-heading" className="text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl dark:text-white">
            Common questions
          </h2>
          <div className="mt-6 border-t border-neutral-200 dark:border-neutral-800">
            {FAQ.map((item) => (
              <details key={item.q} className="group border-b border-neutral-200 dark:border-neutral-800">
                <summary
                  className={`flex cursor-pointer list-none items-start justify-between gap-4 py-4 text-lg font-semibold text-neutral-900 dark:text-white [&::-webkit-details-marker]:hidden ${FOCUS}`}
                >
                  {item.q}
                  <svg aria-hidden="true" className="mt-1.5 size-4 shrink-0 transition-transform group-open:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </summary>
                <div className="pb-5 leading-relaxed text-neutral-700 dark:text-neutral-300">
                  <p>{item.a}</p>
                  <p className="mt-2">
                    <Link href={item.link.href} className={`font-semibold text-primary-600 underline underline-offset-4 dark:text-primary-400 ${FOCUS}`}>
                      {item.link.label}
                    </Link>
                  </p>
                </div>
              </details>
            ))}
          </div>
        </section>

        <section id="how-listed" aria-labelledby="how-listed-heading" className="mt-20 max-w-[68ch] scroll-mt-24 lg:mt-24">
          <h2 id="how-listed-heading" className="text-xl font-bold text-neutral-900 dark:text-white">
            How these products are listed
          </h2>
          <p className="mt-3 leading-relaxed text-neutral-700 dark:text-neutral-300">
            We list devices sold in Australia by a retailer with local warranty support. Prices change daily, so the
            retailer’s site has the current one. These are listings, not reviews: we have not tested these products.
            Devices our guides discuss come first; everything else is listed by name. Some links earn us a commission at no
            extra cost to you, which does not affect what appears here or its order.
          </p>
          <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
            <Link href="/how-we-test/" className={`font-semibold text-primary-600 underline underline-offset-4 dark:text-primary-400 ${FOCUS}`}>
              How we research
            </Link>
            <Link href="/affiliate-disclosure/" className={`font-semibold text-primary-600 underline underline-offset-4 dark:text-primary-400 ${FOCUS}`}>
              Affiliate disclosure
            </Link>
          </p>
        </section>
      </main>
    </>
  );
}
