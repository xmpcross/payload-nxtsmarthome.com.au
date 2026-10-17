/**
 * Google Analytics, Ahrefs Web Analytics and Google AdSense, rendered into
 * <head> on every page.
 *
 * These used to be injected into the exported HTML after the build
 * (scripts/inject-ga.mjs), because anything React
 * renders inline also appears a second time in the RSC payload, and verifiers
 * that text-scan the page then report the tag twice. The site now runs on
 * `next start`, where there is no exported HTML to post-process. So the inline
 * code lives in static files under public/js/ and takes its ids from data-
 * attributes: the page carries only a <script src>, and the snippet text exists
 * once.
 *
 * GA runs with Consent Mode v2 defaults denied until the cookie banner grants
 * them. Ahrefs Web Analytics loads on every page: Ahrefs describes it as
 * using zero cookies and collecting no personal data, so it is not gated.
 * The only affiliate script is Sovrn Commerce (VigLink), rendered by
 * components/VigLink.tsx. Takeads was removed on 6 Oct 2026 and Geniuslink on
 * 17 Oct 2026 (user request).
 *
 * AdSense, two stages (lib/ads.ts). With NEXT_PUBLIC_ADSENSE_CLIENT set, only
 * the google-adsense-account meta renders, which is what Google needs to
 * verify the site for review; no ad script loads. ADS ARE OFF until the site
 * is approved and NEXT_PUBLIC_ADSENSE_SHOW_ADS=1 is set too; then the
 * adsbygoogle.js loader goes on every page as well. No ad units are placed by
 * hand: Auto ads are switched on in the AdSense dashboard. AdSense reads the same Consent Mode
 * v2 signals as GA (defaults denied), and for EEA/UK/CH visitors Google's own
 * consent message (AdSense Privacy & messaging) takes over from our banner —
 * see components/CookieBanner.tsx. Keep app/cookies/page.tsx in step with
 * this list.
 */
import { ADSENSE_CLIENT, ADS_ENABLED } from '@/lib/ads';

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || 'G-SY9XCRZH2K';
const AHREFS_KEY = 'PWhqv6+CSsiInhS/JMQ2SA';

export default function HeadScripts() {
  return (
    <>
      {/* Verification only: no ads without ADS_ENABLED. */}
      {ADSENSE_CLIENT && <meta name="google-adsense-account" content={ADSENSE_CLIENT} />}
      {ADS_ENABLED && (
        <script
          async
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
          crossOrigin="anonymous"
        />
      )}
      {/*
       * ga-init.js queues the consent defaults and config, then loads gtag.js
       * itself once the page has loaded and the browser is idle: gtag.js is
       * 174 KB and ~380 ms of mobile main-thread time (audit perf #6), and
       * analytics waits for consent anyway.
       */}
      <script src="/js/ga-init.js" data-ga-id={GA_ID} defer />
      {/* Ahrefs Web Analytics: cookieless by Ahrefs' account, so not consent-gated. */}
      <script src="https://analytics.ahrefs.com/analytics.js" data-key={AHREFS_KEY} async />
    </>
  );
}
