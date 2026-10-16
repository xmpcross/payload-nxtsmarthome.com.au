import Link from 'next/link'

/*
  The homepage's one H1 and a plain statement of what the site is. Without it
  the page was a feed of article cards with no H1, so neither readers nor search
  engines could tell from the page itself what it covers. Keep the copy in line
  with /about/ and /how-we-test/: research-based guides, no testing claims.
*/
const START_HERE = [
  { label: 'Smart home for beginners', href: '/buying-guides/smart-home-starter-guide-beginners-australia/' },
  { label: 'Smart home for renters', href: '/buying-guides/smart-home-for-renters-australia/' },
  { label: 'Choosing a platform', href: '/hubs-and-platforms/best-smart-home-platform-australia/' },
  { label: 'Video doorbells', href: '/security-and-cameras/video-doorbell-buying-guide-australia/' },
]

export default function HomeIntro({ title }: { title: string }) {
  return (
    <section>
      <h1 className="text-[2.5rem] font-bold tracking-tight text-neutral-900 dark:text-white">{title}</h1>
      <p className="mt-3 text-base leading-relaxed text-neutral-600 dark:text-neutral-400">
        NXT Smart Home is an independent guide to building a smart home in Australia. We explain which devices suit
        Australian wiring and plugs, what renters can set up without drilling, which jobs need a licensed electrician,
        and where to buy from Australian retailers. Our guides are research-based buying advice, not lab reviews.{' '}
        <Link
          href="/how-we-test/"
          className="font-semibold text-primary-600 hover:underline dark:text-primary-400"
        >
          How we research →
        </Link>
      </p>
      <nav aria-label="Start here" className="mt-4 flex flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold text-neutral-900 dark:text-white">Start here:</span>
        {START_HERE.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="inline-flex min-h-11 items-center rounded-full border border-neutral-200 bg-white px-4 py-1 font-medium text-neutral-700 transition hover:border-primary-500 hover:text-primary-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:border-primary-400 dark:hover:text-primary-400"
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </section>
  )
}
