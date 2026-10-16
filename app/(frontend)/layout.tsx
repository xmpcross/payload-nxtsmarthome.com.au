import { getSettings } from '@/lib/site-content'
import type { Metadata } from 'next';
import './globals.css';
import localFont from 'next/font/local';
import { AudioProvider } from '@/components/AudioProvider';
import Aside from '@/components/aside';
import AsideSidebarNavigation from '@/components/aside-sidebar-navigation';
import Footer from '@/components/Footer/Footer';
import Header2 from '@/components/Header/Header2';
import ThemeProvider from './theme-provider';
import CookieBanner from '@/components/CookieBanner';
import FlyonuiScript from '@/components/FlyonuiScript';
import HeadScripts from '@/components/HeadScripts';
import JsonLd from '@/components/JsonLd';
import { site } from '@/lib/site';
import { organisationJsonLd } from '@/lib/seo';

// Site font: Inter for body text and headings, self-hosted from app/fonts/inter
// (Google Fonts, SIL OFL 1.1 — licence alongside). The variable files cover
// every weight; body text uses the default weight (400).
const inter = localFont({
  src: [
    { path: './fonts/inter/Inter-latin-variable.woff2', weight: '100 900', style: 'normal' },
    { path: './fonts/inter/Inter-latin-italic-variable.woff2', weight: '100 900', style: 'italic' },
  ],
  display: 'swap',
  variable: '--font-inter',
});

// Logo wordmark: Urbanist (weight 700), self-hosted from app/fonts/urbanist (Google Fonts,
// SIL OFL 1.1 — licence alongside), used via the font-logo utility (app/globals.css).
const urbanist = localFont({
  src: [
    { path: './fonts/urbanist/UrbanistVariable.woff2', weight: '100 900', style: 'normal' },
    { path: './fonts/urbanist/UrbanistVariable-Italic.woff2', weight: '100 900', style: 'italic' },
  ],
  display: 'swap',
  variable: '--font-urbanist',
});

const outfit = localFont({
  src: [{ path: './fonts/outfit/Outfit-latin-variable.woff2', weight: '100 900', style: 'normal' }],
  display: 'swap',
  variable: '--font-outfit',
});

const defaultMetadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    // 89 chars previously — truncated in every result. Short form fits.
    default: `${site.name} — ${site.shortTagline}`,
    // generateMetadata below sets the live template, "%s | <site name>". Pages
    // pass their title through pageTitle() (lib/seo.ts), which strips a brand
    // already in the text and returns an absolute title (no suffix) when the
    // suffix would push it past ~60 characters — so the brand appears once.
    template: `%s | ${site.name}`,
  },
  description: site.metaDescription,
  applicationName: site.name,
  /*
    No root canonical: it was inherited by every page that sets none — the 404
    page included, which then pointed its canonical at the home page (audit M3).
    Pages set their own through pageAlternates() (lib/seo.ts), which also
    repeats this feed link, since a page's alternates replace these wholesale.
  */
  alternates: { types: { 'application/rss+xml': [{ url: '/feed.xml', title: `${site.name} — latest guides` }] } },
  // Files live in public/. The SVG is served to browsers that support it and stays
  // crisp at any density; the PNGs cover Android/iOS home screens and the .ico is
  // there for older browsers that still request /favicon.ico directly.
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    type: 'website',
    siteName: site.name,
    locale: site.locale,
    url: site.url,
    title: `${site.name} — ${site.shortTagline}`,
    description: site.metaDescription,
    images: [{ url: site.ogImage, width: 1200, height: 630, alt: site.name }],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${site.name} — ${site.shortTagline}`,
    description: site.metaDescription,
    // Without an image a summary_large_image card renders blank.
    images: [site.ogImage],
  },
  // Search engine ownership verification. Rendered into <head> on every page.
  // Add `google: '<code>'` here when Search Console gives you one.
  // Verification codes are per-site — do not copy one between domains.
  //
  // Affiliate link affiliation is handled by the Geniuslink script injected
  // from <head>; see components/HeadScripts.tsx.
  verification: {
    other: {
      'msvalidate.01': '057158952120360611CA2F41AD7D5B50',
      'verify-admitad': 'd39c912cae',
      'Takeads-verification': '2b77af23-a140-4f74-9d19-742b03a689a6',
    },
  },
  /*
    Preview limits only. index/follow are the default and are not stated: the
    404 page inherits this, and stating "index, follow" there contradicted the
    "noindex" Next.js injects on a 404 (audit M3). Pages that must stay out of
    the index set their own robots.
  */
  robots: { 'max-image-preview': 'large', 'max-snippet': -1 },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings();
  const hf = settings.headingFont ?? 'inter';
  const bf = settings.bodyFont ?? 'inter';
  const fontStyle = {
    '--font-sans': `var(--font-${bf}), ui-sans-serif, system-ui, sans-serif`,
    '--font-heading': `var(--font-${hf}), ui-sans-serif, system-ui, sans-serif`,
  } as React.CSSProperties;
  return (
    <html lang={site.language} className={`${inter.variable} ${urbanist.variable} ${outfit.variable}`} style={fontStyle} suppressHydrationWarning>
      <head>
        {/* Impact.com site verification. Written verbatim with `value`, as Impact provides it;
            the metadata API would rewrite `value` to `content`. */}
        <meta {...({ name: 'impact-site-verification', value: 'bd3b6178-4604-4ffc-870b-f0cb0bc2c48f' } as Record<string, string>)} />
        <meta {...({ name: 'impact-site-verification', value: 'c49cb1f9-740b-4f12-a1f6-8dd57e1355cd' } as Record<string, string>)} />
        {/*
          Applies the theme before first paint. Without this a dark reader gets a
          white flash on every navigation, because the class can only be set once
          React hydrates.

          Dark is the default now, rather than the OS preference: the site is
          meant to be read dark, and a light-preferring OS previously overrode
          that. A reader's own choice still wins — the toggle writes 'theme' and
          this reads it first — so this only decides what someone sees before
          they have expressed one.

          The class is set with .add rather than .toggle: the fallback is a
          constant, and toggle(el, true) reads as though it might remove it.
        */}

        <HeadScripts />

        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');document.documentElement.classList.toggle('dark',t?t==='dark':true)}catch(e){document.documentElement.classList.add('dark')}})()`,
          }}
        />
      </head>
      <body className="bg-white font-sans text-base text-neutral-900 antialiased dark:bg-neutral-900 dark:text-neutral-200">
        <JsonLd data={organisationJsonLd()} />
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-50 focus:rounded-sm focus:bg-primary-600 focus:px-4 focus:py-2 focus:text-white"
        >
          Skip to content
        </a>
        <ThemeProvider>
          <AudioProvider>
            <Aside.Provider>
              <Header2 bottomBorder />
              <main id="main">{children}</main>
              <Footer />
              <AsideSidebarNavigation />
            </Aside.Provider>
          </AudioProvider>
        </ThemeProvider>
        <CookieBanner />
        <FlyonuiScript />
      </body>
    </html>
  );
}

export async function generateMetadata(): Promise<Metadata> {
 const settings=await getSettings()
 return {...defaultMetadata,title:{default:settings.name,template:`%s | ${settings.name}`},description:settings.homeDescription||site.metaDescription,openGraph:{...defaultMetadata.openGraph,siteName:settings.name,images:[settings.ogImage]},twitter:{...defaultMetadata.twitter,images:[settings.ogImage]}}
}
