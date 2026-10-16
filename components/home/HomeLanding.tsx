import Link from 'next/link';
import type { Article } from '@/lib/content';
import { articleHref, coverFor, formatDate, typeLabels } from '@/lib/content';
import type { TCategory } from '@/data/categories';
import type { TopProduct } from '@/lib/products';
import { responsiveImg } from '@/lib/image';

/**
 * Home page (redesign approved 17 Oct 2026; preview built from the same data).
 *
 * Built to say plainly what the site is and offers, for readers and for ad and
 * affiliate network reviewers: who it is for, the four kinds of help, the
 * latest guides, topics, live Australian price comparisons, how the guides are
 * made and who edits them, and how the site is funded. Everything shown is
 * live data; nothing is placeholder.
 */

const START_HERE = [
  { label: "Smart home for beginners", href: '/buying-guides/smart-home-starter-guide-beginners-australia/' },
  { label: 'Smart home for renters', href: '/buying-guides/smart-home-for-renters-australia/' },
  { label: 'Choosing a platform', href: '/hubs-and-platforms/best-smart-home-platform-australia/' },
  { label: 'Video doorbells', href: '/security-and-cameras/video-doorbell-buying-guide-australia/' },
];

/** 3D category icons in public/images/category-3d/. */
const ICON: Record<string, string> = {
  'security-and-cameras': 'security-camera',
  lighting: 'smart-bulb',
  'energy-and-solar': 'smart-energy',
  'entertainment-and-audio': 'smart-tv',
  'climate-and-comfort': 'smart-thermostat',
  'hubs-and-platforms': 'smart-home-hub',
  'robot-vacuums': 'smart-vacuum-robot',
  'setup-guides': 'setup-guides',
  'buying-guides': 'buying-guides',
  'smart-door-locks': 'smart-lock-door',
};
const icon = (name: string) => `/images/category-3d/${name}.webp`;

const card =
  'rounded-lg border border-neutral-200 bg-white transition-colors hover:border-primary-600 dark:border-[#313131] dark:bg-[#222324] dark:hover:border-primary-400';
const h2 = 'text-[1.5rem] leading-tight font-bold tracking-tight text-neutral-900 text-balance sm:text-[2rem] dark:text-white';
const meta = 'text-sm text-neutral-600 tabular-nums dark:text-neutral-400';
const more = 'inline-flex shrink-0 items-center gap-1.5 font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300';

function money(v: number) {
  return v % 1 ? `$${v.toFixed(2)}` : `$${v.toLocaleString('en-AU')}`;
}

function SectionHead({ id, title, intro, href, cta }: { id: string; title: string; intro: string; href?: string; cta?: string }) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        <h2 id={id} className={h2}>{title}</h2>
        <p className="mt-1.5 max-w-[68ch] text-neutral-600 dark:text-neutral-400">{intro}</p>
      </div>
      {href && cta ? (
        <Link href={href} className={more}>
          {cta} <span aria-hidden="true">→</span>
        </Link>
      ) : null}
    </div>
  );
}

export type HomeProduct = {
  slug: string;
  name: string;
  category: string;
  image?: string;
  bestFor?: string;
  low: number;
  lowAt: string;
  retailers: number;
};

export default function HomeLanding({
  articles,
  categories,
  products,
  productCount,
  retailerCount,
  editor,
  funding,
}: {
  articles: Article[];
  categories: TCategory[];
  products: HomeProduct[];
  productCount: number;
  retailerCount: number;
  editor: { name: string; slug: string; avatar?: string; bio?: string };
  funding: string;
}) {
  const count = (slug: string) => categories.find((c) => c.handle === slug)?.count ?? 0;
  const topics = categories.filter((c) => c.count > 0);
  const [feature, ...rest] = articles;
  const rows = rest.slice(0, 5);
  const bio = (editor.bio || '').split('. ').slice(0, 2).join('. ').replace(/\.?$/, '.');

  const services = [
    {
      icon: 'buying-guides',
      title: 'Buying guides',
      tag: `${count('buying-guides')} guides`,
      text: 'Shortlists and comparisons for Australian buyers: which models are sold here, what fits B22 and E27 fittings, and who each one suits.',
      href: '/categories/buying-guides/',
    },
    {
      icon: 'setup-guides',
      title: 'Setup and troubleshooting',
      tag: `${count('setup-guides')} guides`,
      text: 'Step-by-step setup for hubs, plugs, cameras and routines, plus fixes for devices that keep dropping off Wi-Fi.',
      href: '/categories/setup-guides/',
    },
    {
      icon: 'smart-plug',
      title: 'Price comparison',
      tag: `${productCount} products`,
      text: `Current prices from ${retailerCount} Australian retailers, including Amazon AU, JB Hi-Fi, Bunnings and Officeworks, so you can see where each device is sold.`,
      href: '/products/',
    },
    {
      icon: 'smart-lock-door',
      title: 'Wiring rules and renting',
      tag: 'Australian law',
      text: 'What you can install yourself under Australian electrical rules, what needs a licensed electrician, and what renters can set up without risking their bond.',
      href: '/setup-guides/smart-home-electrical-work-australia-legal/',
    },
  ];

  return (
    <div className="space-y-14 pb-20 lg:space-y-20 lg:pb-28">
      {/* Hero and numbers: exact copy of the approved preview's top section.
          Styled by .home-top in globals.css (unlayered, so the site-wide h1 and
          paragraph sizes do not override the preview's values). */}
      <div className="home-top">
        <section aria-labelledby="home-hero" className="ht-hero">
          <div className="ht-hero-text">
            <h1 id="home-hero">Smart home advice built for Australian homes</h1>
            <p className="ht-lede">
              NXT Smart Home is an independent guide to choosing, setting up and running smart home technology in Australia.
              We explain what works with 230V wiring and local plugs, what renters can install without drilling, which jobs
              need a licensed electrician, and where each device is sold here.
            </p>
            <div className="ht-actions">
              <Link href={START_HERE[0].href} className="ht-btn ht-btn-primary">
                Start with the beginner&apos;s guide
              </Link>
              <Link href="/products/" className="ht-btn ht-btn-ghost">
                Compare prices
              </Link>
            </div>
            <nav aria-label="Popular starting points" className="ht-start">
              <strong>Popular starting points:</strong>
              {START_HERE.slice(1).map((s) => (
                <Link key={s.href} href={s.href}>
                  {s.label}
                </Link>
              ))}
            </nav>
          </div>
          <figure>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              {...responsiveImg('/images/about/home.webp', 680, '(min-width: 960px) 45vw, 100vw')}
              alt="A bright Australian home entrance with a smart video doorbell"
              width={1024}
              height={768}
              fetchPriority="high"
            />
            <figcaption>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={icon('smart-home-hub')} alt="" width={44} height={44} />
              <span>
                <b>Written for Australia</b>
                <span>230V wiring, AS/NZS rules, local retailers and Australian Consumer Law</span>
              </span>
            </figcaption>
          </figure>
        </section>

        <section aria-label="The site in numbers" className="ht-facts">
          <ul>
            {[
              [articles.length, 'guides and explainers'],
              [productCount, 'products with Australian prices'],
              [retailerCount, 'Australian retailers compared'],
              [0, 'paid placements or sponsored posts'],
            ].map(([n, label]) => (
              <li key={String(label)}>
                <b>{n}</b>
                <span>{label}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Services */}
      <section aria-labelledby="home-services">
        <SectionHead id="home-services" title="What you'll find here" intro="Four kinds of help, each written for how Australians actually buy, install and rent." />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {services.map((s) => (
            <Link key={s.title} href={s.href} className={`${card} flex flex-col gap-3 p-6`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={icon(s.icon)} alt="" width={64} height={64} loading="lazy" className="size-16" />
              <h3 className="text-lg font-bold text-neutral-900 dark:text-white">{s.title}</h3>
              <span className="text-sm font-semibold text-primary-600 tabular-nums dark:text-primary-400">{s.tag}</span>
              <p className="text-[15px] text-neutral-700 dark:text-neutral-300">{s.text}</p>
              <span className={`${more} mt-auto pt-1`}>
                Explore <span aria-hidden="true">→</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Latest guides */}
      {feature ? (
        <section aria-labelledby="home-latest">
          <SectionHead id="home-latest" title="Latest guides" intro="New and updated articles." href="/articles/" cta={`All ${articles.length} articles`} />
          <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr]">
            <article className="min-w-0">
              <Link href={articleHref(feature)} className="group block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  {...responsiveImg(coverFor(feature), 640, '(min-width: 1024px) 50vw, 100vw')}
                  alt=""
                  width={1240}
                  height={775}
                  loading="lazy"
                  className="aspect-[16/10] w-full rounded-lg object-cover"
                />
                <div className={`${meta} mt-4 flex flex-wrap gap-x-2.5 gap-y-1`}>
                  <span className="font-semibold text-primary-600 dark:text-primary-400">{feature.categoryMeta?.name}</span>
                  <span>{typeLabels[feature.type] ?? feature.type}</span>
                  <span>{formatDate(feature.date)}</span>
                  <span>{feature.readingMinutes} min read</span>
                </div>
                <h3 className="mt-2 text-[1.375rem] leading-snug font-bold text-neutral-900 transition-colors group-hover:text-primary-600 sm:text-[1.75rem] dark:text-white dark:group-hover:text-primary-400">
                  {feature.title}
                </h3>
                <p className="mt-2.5 max-w-[68ch] text-neutral-700 dark:text-neutral-300">{feature.description}</p>
              </Link>
            </article>
            <ol className="min-w-0">
              {rows.map((a) => (
                <li key={a.slug} className="border-t border-neutral-200 last:border-b dark:border-neutral-800">
                  <Link href={articleHref(a)} className="group grid grid-cols-[112px_minmax(0,1fr)] items-center gap-4 py-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      {...responsiveImg(coverFor(a), 112, '112px')}
                      alt=""
                      width={112}
                      height={84}
                      loading="lazy"
                      className="aspect-[4/3] w-28 rounded-lg object-cover"
                    />
                    <div className="min-w-0">
                      <div className={`${meta} flex flex-wrap gap-x-2.5`}>
                        <span className="font-semibold text-primary-600 dark:text-primary-400">{a.categoryMeta?.name}</span>
                        <span>{formatDate(a.date)}</span>
                        <span>{a.readingMinutes} min read</span>
                      </div>
                      <h3 className="mt-1 text-base leading-snug font-bold text-neutral-900 transition-colors group-hover:text-primary-600 dark:text-white dark:group-hover:text-primary-400">
                        {a.title}
                      </h3>
                    </div>
                  </Link>
                </li>
              ))}
            </ol>
          </div>
        </section>
      ) : null}

      {/* Topics */}
      <section aria-labelledby="home-topics">
        <SectionHead id="home-topics" title="Browse by topic" intro="Every guide sits in one of these areas of the home." href="/all-topics/" cta="All topics" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {topics.map((c) => (
            <Link key={c.handle} href={`/categories/${c.handle}/`} className={`${card} grid grid-cols-[56px_minmax(0,1fr)] items-center gap-3.5 p-4`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={icon(ICON[c.handle] ?? 'smart-home-hub')} alt="" width={56} height={56} loading="lazy" className="size-14" />
              <span className="min-w-0">
                <span className="block leading-snug font-semibold text-neutral-900 dark:text-white">{c.name}</span>
                {c.description ? <span className="block text-[13px] leading-snug text-neutral-600 dark:text-neutral-400">{c.description}</span> : null}
                <span className="mt-0.5 block text-[13px] font-semibold text-primary-600 tabular-nums dark:text-primary-400">{c.count} guides</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Price comparison */}
      {products.length ? (
        <section aria-labelledby="home-prices" className="-mx-4 bg-neutral-50 px-4 py-14 sm:rounded-lg lg:mx-0 lg:px-8 dark:bg-[#1b2232]">
          <SectionHead
            id="home-prices"
            title="Compare prices from Australian retailers"
            intro="Each product page lists the retailers that sell it in Australia, with the lowest current price first. Check the retailer's site before you buy, because prices change."
            href="/products/"
            cta={`All ${productCount} products`}
          />
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
            {products.map((p) => (
              <Link key={p.slug} href={`/products/${p.slug}/`} className={`${card} flex flex-col overflow-hidden`}>
                <span className="grid aspect-square place-items-center bg-white p-4">
                  {p.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img {...responsiveImg(p.image, 200, '200px')} alt={p.name} width={200} height={200} loading="lazy" className="max-h-full object-contain" />
                  ) : null}
                </span>
                <span className="flex flex-1 flex-col gap-1.5 p-3.5">
                  <span className="text-[13px] text-neutral-600 dark:text-neutral-400">{p.category}</span>
                  <span className="text-[15px] leading-snug font-bold text-neutral-900 dark:text-white">{p.name}</span>
                  {p.bestFor ? <span className="text-[13px] leading-snug text-neutral-600 dark:text-neutral-400">Suits: {p.bestFor}</span> : null}
                  <span className="mt-auto flex items-baseline justify-between gap-2 border-t border-neutral-200 pt-2 text-[13px] text-neutral-600 dark:border-neutral-800 dark:text-neutral-400">
                    <span>
                      From <b className="text-lg text-neutral-900 tabular-nums dark:text-white">{money(p.low)}</b>
                      <br />
                      at {p.lowAt}
                    </span>
                    <span className="tabular-nums">{p.retailers} retailers</span>
                  </span>
                </span>
              </Link>
            ))}
          </div>
          <p className="mt-4 max-w-[80ch] text-[13px] text-neutral-600 dark:text-neutral-400">
            Prices shown are from the last check of each retailer&apos;s listing. Products are researched from manufacturer
            documentation and retailer listings; we do not hands-on test them.
          </p>
        </section>
      ) : null}

      {/* How we work */}
      <section aria-labelledby="home-trust" className="grid items-center gap-10 lg:grid-cols-[1fr_1.1fr]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          {...responsiveImg('/images/about/research.webp', 640, '(min-width: 1024px) 45vw, 100vw')}
          alt="A desk with a laptop, printed product manuals and small smart home devices"
          width={1024}
          height={704}
          loading="lazy"
          className="aspect-[16/11] w-full rounded-lg object-cover"
        />
        <div className="min-w-0">
          <h2 id="home-trust" className={h2}>How we work</h2>
          <ul className="mt-5 grid gap-3.5">
            {[
              ['Research, not lab tests.', 'Guides are built from manufacturer documentation, published specifications, Australian standards and regulator guidance, and each article says what kind of guide it is.'],
              ['Australian sources first.', "Electrical, privacy and tenancy advice links to the official source, such as your state's electrical safety regulator or the ACCC."],
              ['Corrections are noted.', "When something we published is wrong, we fix it and update the article's date."],
              ['No paid coverage.', 'Brands do not pay for coverage or approve articles before they are published.'],
            ].map(([b, t]) => (
              <li key={b} className="grid grid-cols-[24px_minmax(0,1fr)] gap-3">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true" className="mt-1 text-primary-600 dark:text-primary-400">
                  <path d="M4 10.5l4 4 8-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <p className="text-neutral-700 dark:text-neutral-300">
                  <b className="font-semibold text-neutral-900 dark:text-white">{b}</b> {t}
                </p>
              </li>
            ))}
          </ul>
          <Link href={`/authors/${editor.slug}/`} className={`${card} mt-6 grid grid-cols-[64px_minmax(0,1fr)] items-center gap-4 p-4`}>
            {editor.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img {...responsiveImg(editor.avatar, 64, '64px')} alt={editor.name} width={64} height={64} loading="lazy" className="size-16 rounded-[50%] object-cover" />
            ) : (
              <span className="size-16" />
            )}
            <span className="min-w-0">
              <span className="block font-semibold text-neutral-900 dark:text-white">Edited by {editor.name}</span>
              {bio.length > 1 ? <span className="block text-sm text-neutral-600 dark:text-neutral-400">{bio}</span> : null}
            </span>
          </Link>
          <p className="mt-4 rounded-lg bg-primary-50 p-4 text-sm text-neutral-700 dark:bg-primary-500/10 dark:text-neutral-300">
            <b className="font-semibold text-neutral-900 dark:text-white">How the site is funded.</b> {funding} Read our{' '}
            <Link href="/affiliate-disclosure/" className="font-semibold text-primary-600 underline underline-offset-4 dark:text-primary-400">
              affiliate disclosure
            </Link>{' '}
            and{' '}
            <Link href="/how-we-test/" className="font-semibold text-primary-600 underline underline-offset-4 dark:text-primary-400">
              how we research
            </Link>
            .
          </p>
        </div>
      </section>
    </div>
  );
}
