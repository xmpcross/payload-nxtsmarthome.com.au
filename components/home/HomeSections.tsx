import Link from 'next/link'
import ProductCard from '@/components/ProductCard'
import ProductCarousel from '@/components/home/ProductCarousel'
import FlyonAccordion from '@/components/flyonui/FlyonAccordion'
import type { TCategory } from '@/data/categories'
import type { TPost } from '@/data/posts'
import type { TopProduct } from '@/lib/products'
import { getCategory, site } from '@/lib/site'
import { AFFILIATE_ENABLED } from '@/lib/affiliate'
import { responsiveImg } from '@/lib/image'

/*
 * Completely new, shadowless design for Home Page sections (Oct 2026).
 * Focuses on crisp hairline borders, elegant typography, subtle background tints,
 * and high-contrast dark/light mode aesthetics without ANY drop shadows.
 */

export function HomeHero({ articleCount, topicCount }: { articleCount: number; topicCount: number }) {
  return (
    <section className="relative">
      <div className="relative z-10 max-w-4xl">
        <h1 className="text-4xl font-black tracking-tight text-neutral-900 sm:text-6xl dark:text-white">
          Smart Home Guides for{' '}
          <span className="bg-gradient-to-r from-primary-600 via-indigo-500 to-purple-600 bg-clip-text text-transparent dark:from-primary-400 dark:via-indigo-300 dark:to-purple-400">
            Australian Homes.
          </span>
        </h1>

        <p className="mt-5 text-lg leading-relaxed text-neutral-600 dark:text-neutral-300">
          Buying advice, setup help, and explainers for smart lighting, security cameras, energy monitoring, climate control, robot vacuums, and platforms — written for 230V wiring, Australian retailers, renters, and owners.
        </p>

        <div className="mt-8 flex flex-wrap gap-4">
          <Link
            href="/articles/"
            className="btn btn-primary gap-2 font-bold transition-all hover:bg-primary-700"
          >
            Browse All {articleCount} Guides
            <svg className="size-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
          </Link>
          <Link
            href="/all-topics/"
            className="btn btn-outline border-neutral-300 bg-white font-bold text-neutral-800 hover:border-primary-500 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
          >
            Explore {topicCount} Topics
          </Link>
        </div>

        {/* Live Feature Stats - Clean Hairline Borders */}
        <div className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-4 pt-8 border-t border-neutral-200 dark:border-neutral-800">
          <div className="rounded-2xl border border-neutral-200 bg-white/60 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
            <div className="text-2xl font-extrabold text-primary-600 dark:text-primary-400">{articleCount}+</div>
            <div className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">In-Depth Guides</div>
          </div>
          <div className="rounded-2xl border border-neutral-200 bg-white/60 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
            <div className="text-2xl font-extrabold text-primary-600 dark:text-primary-400">{topicCount}</div>
            <div className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">Core Topics</div>
          </div>
          <div className="rounded-2xl border border-neutral-200 bg-white/60 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
            <div className="text-2xl font-extrabold text-primary-600 dark:text-primary-400">230V AU</div>
            <div className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">Wiring Tested</div>
          </div>
          <div className="rounded-2xl border border-neutral-200 bg-white/60 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
            <div className="text-2xl font-extrabold text-primary-600 dark:text-primary-400">NBN / Wi-Fi</div>
            <div className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">2.4GHz Verified</div>
          </div>
        </div>
      </div>
    </section>
  )
}

/** TopicTile - Ultra-clean shadowless card with hairline borders */
export function TopicTile({ topic }: { topic: TCategory }) {
  const newest = topic.posts?.[0]
  const meta = getCategory(topic.handle)
  const emoji = meta?.emoji || '⚡'

  return (
    <Link
      href={`/categories/${topic.handle}/`}
      className="group flex h-full flex-col justify-between overflow-hidden rounded-3xl border border-neutral-200 bg-white p-7 transition-all duration-300 hover:border-primary-500 hover:bg-neutral-50/60 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-primary-400 dark:hover:bg-neutral-800/40"
    >
      <div>
        <div className="flex items-center justify-between gap-4">
          <span
            className="flex size-14 items-center justify-center rounded-2xl bg-primary-50 text-3xl transition-transform duration-300 group-hover:scale-110 dark:bg-primary-950/60"
            aria-hidden="true"
          >
            {emoji}
          </span>
          <span className="badge badge-soft badge-primary font-bold text-xs py-1.5 px-3 rounded-full border border-primary-500/20 dark:border-primary-500/30">
            {topic.count} {topic.count === 1 ? 'guide' : 'guides'}
          </span>
        </div>

        <h3 className="mt-6 text-2xl font-bold tracking-tight text-neutral-900 group-hover:text-primary-600 dark:text-white dark:group-hover:text-primary-400 transition-colors">
          {topic.name}
        </h3>
        <p className="mt-2.5 text-sm leading-relaxed text-neutral-600 dark:text-neutral-300 line-clamp-2">
          {meta?.intro || topic.description}
        </p>
      </div>

      {newest && (
        <div className="mt-6 pt-4 border-t border-neutral-100 dark:border-neutral-800">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-1">
            <span>Latest Guide</span>
            <span className="text-primary-600 dark:text-primary-400 group-hover:translate-x-1 transition-transform">→</span>
          </div>
          <span className="line-clamp-1 block text-xs font-semibold text-neutral-800 group-hover:text-primary-600 dark:text-neutral-200 dark:group-hover:text-primary-400">
            {newest.title}
          </span>
        </div>
      )}
    </Link>
  )
}

/** HomeTopics - Shadowless Section */
export function HomeTopics({ topics }: { topics: TCategory[] }) {
  if (!topics.length) return null
  const displayTopics = topics.slice(0, 6)
  return (
    <section>
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-neutral-200 pb-5 dark:border-neutral-800">
        <div>
          <span className="badge badge-soft badge-primary text-xs font-bold uppercase tracking-wider mb-2">
            Topic Directory
          </span>
          <h2 className="text-3xl font-black tracking-tight text-neutral-900 dark:text-white sm:text-4xl">
            Browse Smart Home Topics
          </h2>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            Explore core categories covering security, lighting, climate, energy, and platforms.
          </p>
        </div>
        <Link
          href="/all-topics/"
          className="btn btn-sm btn-outline border-neutral-300 dark:border-neutral-700 text-xs font-bold rounded-xl shrink-0"
        >
          All Topics & Categories →
        </Link>
      </div>

      <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {displayTopics.map((topic) => (
          <li key={topic.id}>
            <TopicTile topic={topic} />
          </li>
        ))}
      </ul>
    </section>
  )
}

/** HomeTopicSection - Hairline border layout without box shadows */
export function HomeTopicSection({
  category,
  posts,
  flip,
}: {
  category: TCategory
  posts: TPost[]
  flip?: boolean
}) {
  if (!posts.length) return null
  const [lead, ...rest] = posts
  const list = rest.slice(0, 4)
  const meta = getCategory(category.handle)
  const emoji = meta?.emoji || '⚡'

  return (
    <section className="relative">
      {/* Section Header */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-200 pb-6 dark:border-neutral-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="badge badge-soft badge-primary text-[10px] font-bold uppercase tracking-wider rounded-full px-2.5 py-0.5">
              Topic Showcase
            </span>
            <span className="text-xs font-semibold text-neutral-400">
              {category.count} {category.count === 1 ? 'guide' : 'guides'}
            </span>
          </div>
          <h2 className="text-2xl font-black tracking-tight text-neutral-900 dark:text-white sm:text-3xl">
            {category.name}
          </h2>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{meta?.intro || category.description}</p>
        </div>
        <Link
          href={`/categories/${category.handle}/`}
          className="btn btn-sm btn-primary font-bold rounded-xl shrink-0 self-start md:self-center"
        >
          All {category.count} {category.name} Guides →
        </Link>
      </div>

      {/* Main Grid: Lead Card + Ranked Article List */}
      <div className="grid gap-8 lg:grid-cols-5">
        {/* Lead Featured Article Card */}
        <Link
          href={`/${lead.handle}`}
          className={`group flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50/50 transition-all duration-300 hover:border-primary-500 hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-800/40 dark:hover:border-primary-400 ${
            list.length ? 'lg:col-span-2' : 'lg:col-span-5'
          } ${flip ? 'lg:order-2' : ''}`}
        >
          <div className="relative aspect-16/10 w-full overflow-hidden bg-neutral-200 dark:bg-neutral-800">
            {lead.featuredImage?.src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                {...responsiveImg(lead.featuredImage.src, 1200, '(max-width: 1024px) 100vw, 50vw')}
                alt={lead.featuredImage.alt || lead.title}
                width={1200}
                height={750}
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                loading="lazy"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary-500/15 via-indigo-500/10 to-purple-500/15 text-6xl">
                <span aria-hidden="true">{emoji}</span>
              </div>
            )}
          </div>
          <div className="flex flex-1 flex-col p-6">
            <div className="flex items-center gap-2 mb-2">
              <span className="badge badge-soft badge-primary text-[10px] font-bold uppercase tracking-wider rounded-full px-2.5 py-0.5">
                Featured Lead
              </span>
              <span className="text-[11px] font-medium text-neutral-400">
                {lead.readingTime} min read
              </span>
            </div>
            <h3 className="text-xl font-bold leading-snug text-neutral-900 group-hover:text-primary-600 dark:text-white dark:group-hover:text-primary-400 transition-colors">
              {lead.title}
            </h3>
            {lead.excerpt && (
              <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-neutral-600 dark:text-neutral-300">{lead.excerpt}</p>
            )}
            <div className="mt-auto pt-5 flex items-center justify-between text-xs font-semibold text-primary-600 dark:text-primary-400">
              <span>Read Full Guide</span>
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </div>
          </div>
        </Link>

        {/* Next Ranked Articles List */}
        {list.length > 0 && (
          <ol className={`flex flex-col divide-y divide-neutral-200 dark:divide-neutral-800 lg:col-span-3 ${flip ? 'lg:order-1' : ''}`}>
            {list.map((post) => (
              <li key={post.id} className="py-4.5 first:pt-0 last:pb-0">
                <Link href={`/${post.handle}`} className="group flex items-center gap-4.5">
                  <span className="relative size-20 sm:size-24 shrink-0 overflow-hidden rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-800">
                    {post.featuredImage?.src ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        {...responsiveImg(post.featuredImage.src, 96, '96px')}
                        alt={post.featuredImage.alt || post.title}
                        width={96}
                        height={96}
                        className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        loading="lazy"
                      />
                    ) : (
                      <span className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary-500/20 via-indigo-500/20 to-purple-500/20 text-2xl">
                        <span aria-hidden="true">{emoji}</span>
                      </span>
                    )}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="font-bold leading-snug text-neutral-900 group-hover:text-primary-600 dark:text-white dark:group-hover:text-primary-400 transition-colors text-base">
                      {post.title}
                    </span>
                    {post.excerpt && (
                      <span className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">{post.excerpt}</span>
                    )}
                    <div className="mt-2.5 flex items-center gap-3 text-[11px] font-medium text-neutral-400">
                      <span>{post.readingTime} min read</span>
                      <span>·</span>
                      <span className="group-hover:text-primary-600 dark:group-hover:text-primary-400 font-semibold transition-colors">Read article →</span>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  )
}

/** HomeFaq - FAQs section for bottom of home page */
export function HomeFaq() {
  const faqItems = [
    {
      id: 'electrician-req',
      question: 'Do I need a licensed electrician to install smart switches in Australia?',
      answer:
        'Yes. Under AS/NZS 3000 wiring standards, any 230V mains electrical work in Australia—including hardwired smart light switches, smart power points, ceiling fan controllers, and outdoor security lights—must legally be performed by a licensed electrician. DIY smart plugs, battery sensors, and plug-in devices do not require an electrician.',
      link: { href: '/categories/lighting/', label: 'Explore Smart Lighting & Wiring Guides' },
    },
    {
      id: 'ecosystem-choice',
      question: 'Which smart home ecosystem works best for Australian households?',
      answer:
        'Apple HomeKit, Google Home, and Home Assistant are all widely supported in Australia. Apple HomeKit excels in local privacy and fast response times, Google Home offers seamless Google Assistant voice control and broad hardware compatibility, and Home Assistant is ideal for advanced users wanting local Zigbee or Z-Wave automation without cloud dependencies.',
      link: { href: '/all-topics/', label: 'View All Topic Categories' },
    },
    {
      id: 'overseas-devices',
      question: 'Can I import and use overseas smart home devices in Australia?',
      answer:
        'Exercise caution. US devices run on 110V power and non-AU wireless frequencies (e.g. US Z-Wave operates at 908.4MHz, which conflicts with Australian RF spectrum allocations). Importing non-compliant 230V mains gear violates safety laws and voids home insurance. Always check for the Regulatory Compliance Mark (RCM) logo on devices.',
      link: { href: '/how-we-test/', label: 'Learn About Australian Compliance' },
    },
    {
      id: 'au-retailers',
      question: 'Where can I buy genuine Australian-certified smart home gear?',
      answer:
        'Major authorized Australian retailers include JB Hi-Fi, Bunnings Warehouse, Officeworks, The Good Guys, and Amazon AU. Buying RCM-certified models locally ensures 230V compliance, official firmware updates, and protection under Australian Consumer Law (ACL) warranties.',
      link: { href: '/products/', label: 'Compare Product Prices & Retailers' },
    },
    {
      id: 'matter-standard',
      question: 'What is Matter and should I prioritize Matter-certified smart devices?',
      answer:
        'Matter is an open-source interoperability standard backed by Apple, Google, Amazon, and Samsung. Matter devices work locally across multiple smart home apps simultaneously without needing custom bridges. Choosing Matter-certified devices ensures future-proof compatibility regardless of which smartphone ecosystem you use.',
      link: { href: '/articles/', label: 'Read Our Smart Home Tech Guides' },
    },
    {
      id: 'energy-savings',
      question: 'How do smart home devices help reduce Australian electricity bills?',
      answer:
        'Intelligent climate controllers (like Sensibo or Tado for split systems), smart solar-diverting EV chargers, and automated off-peak appliance schedules can trim household electricity bills by 15-30%—especially during extreme Australian summer heatwaves.',
      link: { href: '/categories/energy-and-solar/', label: 'Browse Energy & Solar Guides' },
    },
  ]

  return (
    <section className="relative">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-neutral-200 pb-5 dark:border-neutral-800">
        <div>
          <span className="badge badge-soft badge-primary text-xs font-bold uppercase tracking-wider mb-2">
            Frequently Asked Questions
          </span>
          <h2 className="text-2xl font-black text-neutral-900 dark:text-white sm:text-3xl">
            Smart Home FAQs for Australians
          </h2>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            Answers to common questions about electrical compliance, ecosystem compatibility, and device selection.
          </p>
        </div>
      </div>

      <FlyonAccordion items={faqItems} alwaysOpen={false} columns={2} />
    </section>
  )
}

/** HomeSetupGuides */
export function HomeSetupGuides({
  heading,
  subHeading,
  posts,
  moreHref,
  moreLabel,
}: {
  heading: string
  subHeading?: string
  posts: TPost[]
  moreHref: string
  moreLabel: string
}) {
  if (!posts.length) return null
  return (
    <section>
      <div className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-neutral-200 pb-5 dark:border-neutral-800">
        <div>
          <span className="badge badge-soft badge-primary text-xs font-bold uppercase tracking-wider mb-2">
            Step-by-Step
          </span>
          <h2 className="text-3xl font-black text-neutral-900 dark:text-white">{heading}</h2>
          {subHeading && <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{subHeading}</p>}
        </div>
        <Link href={moreHref} className="btn btn-sm btn-primary rounded-lg font-semibold">
          {moreLabel} →
        </Link>
      </div>

      <ul className="grid gap-6 md:grid-cols-2">
        {posts.map((post) => (
          <li key={post.id}>
            <Link
              href={`/${post.handle}`}
              className="group flex items-center gap-5 rounded-2xl border border-neutral-200 bg-white p-4 transition-all hover:border-primary-500 hover:bg-neutral-50/50 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:bg-neutral-800/50"
            >
              <span className="relative size-20 shrink-0 overflow-hidden rounded-xl sm:size-24 bg-neutral-100 dark:bg-neutral-800">
                {post.featuredImage?.src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    {...responsiveImg(post.featuredImage.src, 96, '96px')}
                    alt={post.featuredImage.alt || post.title}
                    width={96}
                    height={96}
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                  />
                ) : (
                  <span className="absolute inset-0 bg-gradient-to-br from-primary-500/20 to-purple-500/20" />
                )}
              </span>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="badge badge-soft badge-primary text-[10px] font-bold uppercase tracking-wider mb-1 w-fit">
                  How-To · {post.readingTime} min
                </span>
                <span className="font-bold leading-snug text-neutral-900 group-hover:text-primary-600 dark:text-white dark:group-hover:text-primary-400 transition-colors text-sm">
                  {post.title}
                </span>
                {post.excerpt && (
                  <span className="mt-1 line-clamp-1 text-xs text-neutral-600 dark:text-neutral-400">{post.excerpt}</span>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** HomeProducts - 1-row auto-sliding product carousel (max 8 items) */
export function HomeProducts({ products }: { products: TopProduct[] }) {
  if (!products.length) return null

  return (
    <section className="relative">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-neutral-200 pb-5 dark:border-neutral-800">
        <div>
          <span className="badge badge-soft badge-primary text-xs font-bold uppercase tracking-wider mb-2">
            Catalog Spotlight
          </span>
          <h2 className="text-2xl font-black text-neutral-900 dark:text-white sm:text-3xl">
            Researched Products & Prices
          </h2>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            Comparing prices across Australian retailers including JB Hi-Fi, Bunnings, and Amazon AU.
          </p>
        </div>
        <Link href="/products/" className="btn btn-sm btn-primary font-bold rounded-xl shrink-0">
          All Products & Prices →
        </Link>
      </div>

      <ProductCarousel products={products} />
    </section>
  )
}

export function HomeTrust({ editorName, editorSlug }: { editorName: string; editorSlug: string }) {
  const points = [
    {
      title: 'Australian Electrical Compliance',
      body: 'Evaluated for 230V wiring, AS/NZS standards, RCM authorization, local retailer warranties, and climate conditions.',
    },
    {
      title: 'Editorial & Research Integrity',
      body: 'Built from manufacturer datasheets, official standard documents, and verified Australian retailer price feeds.',
    },
    {
      title: 'Fact-Checked Safety Rules',
      body: 'Clear distinctions between DIY low-voltage solutions and legally required licensed electrician installations in Australia.',
    },
  ]
  return (
    <section className="relative">
      <div className="max-w-3xl mb-8">
        <span className="badge badge-soft badge-primary text-xs font-bold uppercase tracking-wider mb-2">
          Trust & Methodology
        </span>
        <h2 className="text-3xl font-black text-neutral-900 dark:text-white sm:text-4xl">
          How We Research & Review
        </h2>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">
          Edited by <Link href={`/authors/${editorSlug}/`} className="font-bold text-primary-600 underline dark:text-primary-400">{editorName}</Link>. Independent: {AFFILIATE_ENABLED ? 'affiliate links never dictate recommendations' : 'no brand or retailer influences our reviews'}.
        </p>
      </div>

      <ul className="grid gap-6 md:grid-cols-3">
        {points.map((p) => (
          <li key={p.title} className="rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
            <h3 className="text-base font-bold text-neutral-900 dark:text-white">{p.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-neutral-600 dark:text-neutral-300">{p.body}</p>
          </li>
        ))}
      </ul>

      <div className="mt-8 flex flex-wrap gap-4 text-xs font-bold">
        <Link href="/how-we-test/" className="btn btn-xs sm:btn-sm btn-primary rounded-lg">
          Our Research Process →
        </Link>
        <Link href="/about/" className="btn btn-xs sm:btn-sm btn-outline border-neutral-300 dark:border-neutral-700 rounded-lg">
          About {site.name} →
        </Link>
      </div>
    </section>
  )
}
