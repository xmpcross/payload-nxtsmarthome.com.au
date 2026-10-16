import { getSettings } from '@/lib/site-content'
import { CustomLink } from '@/data/types'
import { categories, site } from '@/lib/site'
import Logo from '@/shared/Logo'
import Link from 'next/link'
import React from 'react'
import CookieSettingsLink from '../CookieSettingsLink'
import { ADS_ENABLED } from '@/lib/ads'
import { AFFILIATE_ENABLED } from '@/lib/affiliate'

export interface WidgetFooterMenu {
  id: string
  title: string
  menus: CustomLink[]
}

const widgetMenus: WidgetFooterMenu[] = [
  {
    id: 'topics',
    title: 'Topics',
    menus: categories.slice(0, 5).map((c) => ({ href: `/categories/${c.slug}/`, label: c.name })),
  },
  {
    id: 'more',
    title: 'More topics',
    menus: [
      ...categories.slice(5).map((c) => ({ href: `/categories/${c.slug}/`, label: c.name })),
      { href: '/all-topics/', label: 'All topics' },
    ],
  },
  {
    id: 'site',
    title: 'The site',
    menus: [
      { href: '/articles/', label: 'All articles' },
      { href: '/products/', label: 'Products' },
      { href: '/about/', label: 'About us' },
      { href: '/how-we-test/', label: 'How we research' },
      { href: '/contact/', label: 'Contact' },
      { href: '/sitemap/', label: 'Sitemap' },
    ],
  },
  {
    id: 'legal',
    title: 'Legal',
    menus: [
      { href: '/affiliate-disclosure/', label: 'Affiliate disclosure' },
      { href: '/privacy/', label: 'Privacy policy' },
      { href: '/terms/', label: 'Terms and conditions' },
      { href: '/cookies/', label: 'Cookie information' },
    ],
  },
]

const svgProps = {
  viewBox: '0 0 24 24',
  className: 'size-4',
  'aria-hidden': true,
} as const
const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

const shareUrl = encodeURIComponent(`${site.url}/`)
const shareText = encodeURIComponent(`${site.name}: smart home guides for Australian homes`)

/*
 * Footer icons. Only Facebook is a profile; Twitter/X, Reddit and WhatsApp are
 * "share this site" links, because the site has no profile on them (add one to
 * site.social and link it here to change that).
 */
const socials: { label: string; href: string; external?: boolean; icon: React.ReactNode }[] = [
  ...(site.social.facebook
    ? [
        {
          label: `${site.name} on Facebook`,
          href: site.social.facebook,
          external: true,
          icon: (
            <svg {...svgProps} fill="currentColor">
              <path d="M13.5 21v-7.5h2.5l.4-3h-2.9V8.6c0-.9.3-1.5 1.5-1.5h1.5V4.4c-.3 0-1.2-.1-2.2-.1-2.2 0-3.7 1.3-3.7 3.8v2.4H8v3h2.6V21h2.9Z" />
            </svg>
          ),
        },
      ]
    : []),
  {
    label: 'Share on Twitter / X',
    href: `https://twitter.com/intent/tweet?url=${shareUrl}&text=${shareText}`,
    external: true,
    icon: (
      <svg {...svgProps} fill="currentColor">
        <path d="M18.9 2h3.4l-7.4 8.5L23.6 22h-6.8l-5.3-7-6.1 7H2l7.9-9.1L1.7 2h7l4.8 6.4L18.9 2Zm-1.2 18h1.9L7.7 3.9H5.7L17.7 20Z" />
      </svg>
    ),
  },
  {
    label: 'Share on Reddit',
    href: `https://www.reddit.com/submit?url=${shareUrl}&title=${shareText}`,
    external: true,
    icon: (
      <svg {...svgProps} {...stroke}>
        <ellipse cx="12" cy="14" rx="8" ry="5.5" />
        <circle cx="9" cy="13" r="1" fill="currentColor" stroke="none" />
        <circle cx="15" cy="13" r="1" fill="currentColor" stroke="none" />
        <path d="M9.5 16.3c1.5 1 3.5 1 5 0" />
        <path d="M12 8.5 13.2 3l4 1" />
        <circle cx="18" cy="4.2" r="1.2" />
        <circle cx="4.2" cy="11.5" r="1.6" />
        <circle cx="19.8" cy="11.5" r="1.6" />
      </svg>
    ),
  },
  {
    label: 'Share on WhatsApp',
    href: `https://wa.me/?text=${shareText}%20${shareUrl}`,
    external: true,
    icon: (
      <svg {...svgProps} {...stroke}>
        <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
        <path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1.3-1.6-2-1-.9.8c-.9-.4-1.6-1.1-2-2l.8-.9-1-2L9 9.5Z" />
      </svg>
    ),
  },
  {
    label: `Email ${site.name}`,
    href: `mailto:${site.organisation.email}`,
    icon: (
      <svg {...svgProps} {...stroke}>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3 7 9 6 9-6" />
      </svg>
    ),
  },
  {
    label: 'RSS feed',
    href: '/feed.xml',
    icon: (
      <svg {...svgProps} {...stroke}>
        <path d="M4 11a9 9 0 0 1 9 9" />
        <path d="M4 4a16 16 0 0 1 16 16" />
        <circle cx="5" cy="19" r="1" fill="currentColor" />
      </svg>
    ),
  },
]

const linkClass =
  'text-neutral-600 transition-colors hover:text-primary-600 dark:text-neutral-400 dark:hover:text-white'

/**
 * Site footer.
 *
 * Brand block (logo, what the site is, how to reach us) beside four link
 * columns; then a disclosure strip, because an affiliate-and-advertising site
 * should say so where every page ends; then the bottom bar naming the business
 * that operates the site (site.organisation.operator, the same name /about/,
 * /contact/ and /privacy/ use).
 */
const Footer = async () => {
  const site = await getSettings()
  const year = new Date().getFullYear()

  return (
    <footer className="nc-Footer relative bg-neutral-50 dark:bg-neutral-950">
      <div className="container grid gap-12 py-16 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,3fr)] lg:gap-16 lg:py-20">
        {/* Brand */}
        <div className="flex max-w-sm flex-col gap-5">
          <Logo size="size-10" alwaysShowWordmark />
          <p className="text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
            {site.footerDescription}
          </p>
          {/* Email only, 18px bold (user request, 24 Sep 2026); the Contact
              page is in the site column below. break-all keeps it inside
              the column on a phone. */}
          <a
            href={`mailto:${site.organisation.email}`}
            className="text-[18px] font-bold break-all text-neutral-800 hover:text-primary-600 dark:text-neutral-100 dark:hover:text-white"
          >
            {site.organisation.email}
          </a>
          <ul className="flex flex-wrap gap-2" aria-label={`${site.name} on social media and feeds`}>
            {socials.map((item) => (
              <li key={item.label}>
                <a
                  href={item.href}
                  {...(item.external ? { rel: 'noopener', target: '_blank' } : {})}
                  aria-label={item.label}
                  title={item.label}
                  className="inline-flex size-9 items-center justify-center rounded-lg border border-neutral-300 text-neutral-600 transition hover:border-primary-600 hover:text-primary-600 dark:border-neutral-700 dark:text-neutral-300 dark:hover:border-white dark:hover:text-white"
                >
                  {item.icon}
                </a>
              </li>
            ))}
          </ul>
        </div>

        {/* Link columns */}
        <nav aria-label="Footer" className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-4">
          {widgetMenus.map((menu) => (
            <div key={menu.id} className="text-sm">
              <h2 className="font-logo text-[0.8125rem] font-bold tracking-wider text-neutral-900 uppercase dark:text-white">
                {menu.title}
              </h2>
              <ul className="mt-5 space-y-3.5">
                {menu.menus.map((item) => (
                  <li key={item.href}>
                    <Link className={linkClass} href={item.href}>
                      {item.label}
                    </Link>
                  </li>
                ))}
                {menu.id === 'legal' && (
                  <li>
                    <CookieSettingsLink className={`${linkClass} cursor-pointer`} />
                  </li>
                )}
              </ul>
            </div>
          ))}
        </nav>
      </div>

      {/* Disclosure strip */}
      <div className="container">
        <div className="rounded-lg border border-neutral-200 bg-white px-5 py-4 text-xs leading-relaxed text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
          <strong className="font-semibold text-neutral-800 dark:text-neutral-200">Independent and reader-supported.</strong>{' '}
          {AFFILIATE_ENABLED
            ? ADS_ENABLED
              ? 'Some links to retailers are affiliate links, and the site shows advertising; both are labelled and neither decides what we write.'
              : 'Some links to retailers are affiliate links; they are labelled and never decide what we write.'
            : ADS_ENABLED
              ? 'The site shows advertising; it is labelled and never decides what we write.'
              : 'No brand or retailer pays for coverage or decides what we write.'}{' '}
          See our{' '}
          <Link href="/affiliate-disclosure/" className="underline underline-offset-2 hover:text-primary-600">
            affiliate disclosure
          </Link>
          . Our guides are general information, not electrical or legal advice.
        </div>
      </div>

      {/* Bottom bar */}
      <div className="container flex flex-col gap-3 py-8 text-xs text-neutral-500 sm:flex-row sm:items-center sm:justify-between dark:text-neutral-500">
        <p>
          © {year} {site.name}. Operated by {site.organisation.operator}.
        </p>
        <a href="#" className="hover:text-primary-600 dark:hover:text-white">
          Back to top ↑
        </a>
      </div>
    </footer>
  )
}

export default Footer
