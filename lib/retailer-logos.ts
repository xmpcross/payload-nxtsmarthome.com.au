/**
 * Retailer brand marks in public/images/retailers, matched on the retailer
 * name. The single list behind the price box (RetailerPriceList), the "Where to
 * Buy" table (RetailerPriceTable) and the product cards (RetailerLogo); keeping
 * one copy is what stops a new logo showing in one place and not the others.
 *
 * Amazon, eBay, BIG W, Dick Smith, Telstra and Bing Lee are public-domain marks from Wikimedia
 * Commons (Dick Smith cropped to the wordmark, without the old tagline); the
 * rest are supplied brand assets. Woolworths is the logo from woolworths.com.au
 * (fetched 17 Oct 2026, trimmed, transparent background); Anker SOLIX is the header
 * wordmark from ankersolix.com (its SVG sprite symbol "ankersolix", 17 Oct 2026); Kmart is the header
 * logo (inline SVG) from kmart.com.au, 17 Oct 2026; Appliances Online is the logo from
 * appliancesonline.com.au, cropped to the icon and wordmark (without the "legendary service" tagline). Most marks are drawn for a light background,
 * so consumers put them on white, in dark mode too; `dark` marks (white
 * lettering) go on black instead.
 *
 * No imports: client components use it.
 */
const RETAILER_LOGOS: Array<{ match: string; src: string; dark?: boolean }> = [
  { match: 'jb hi-fi', src: '/images/retailers/jbhifi.png' },
  { match: 'jbhifi', src: '/images/retailers/jbhifi.png' },
  // White lettering: needs a dark backing, not the usual white.
  { match: 'good guys', src: '/images/retailers/thegoodguys.png', dark: true },
  { match: 'harvey norman', src: '/images/retailers/HarveyNorman.svg' },
  { match: 'officeworks', src: '/images/retailers/officeworks.png' },
  { match: 'bunnings', src: '/images/retailers/bunnings.png' },
  { match: 'kogan', src: '/images/retailers/kogan.png' },
  { match: 'scorptec', src: '/images/retailers/scorptec.png' },
  { match: 'mwave', src: '/images/retailers/mwave-logo.png' },
  { match: 'amazon', src: '/images/retailers/amazon-au.svg' },
  { match: 'ebay', src: '/images/retailers/ebay-au.svg' },
  { match: 'big w', src: '/images/retailers/big-w.png' },
  { match: 'dick smith', src: '/images/retailers/dick-smith.png' },
  { match: 'telstra', src: '/images/retailers/telstra.svg' },
  { match: 'woolworths', src: '/images/retailers/woolworths.png' },
  { match: 'kmart', src: '/images/retailers/kmart.svg' },
  { match: 'appliances online', src: '/images/retailers/appliances-online.png' },
  { match: 'appliancesonline', src: '/images/retailers/appliances-online.png' },
  { match: 'anker au', src: '/images/retailers/anker-solix.svg' },
  { match: 'anker solix', src: '/images/retailers/anker-solix.svg' },
  { match: 'ankersolix', src: '/images/retailers/anker-solix.svg' },
  { match: 'bing lee', src: '/images/retailers/bing-lee.png' },
  { match: 'binglee', src: '/images/retailers/bing-lee.png' },
];

/** Logo path for a retailer name, or null when there is no mark on file. */
export function retailerLogoSrc(name: string): string | null {
  const lower = name.toLowerCase();
  return RETAILER_LOGOS.find((l) => lower === l.match || lower.includes(l.match))?.src ?? null;
}

/** Whether a retailer's mark needs a dark backing (white lettering). */
export function retailerLogoIsDark(name: string): boolean {
  const lower = name.toLowerCase();
  return Boolean(RETAILER_LOGOS.find((l) => lower === l.match || lower.includes(l.match))?.dark);
}
