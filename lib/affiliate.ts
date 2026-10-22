/**
 * Affiliate link layer.
 *
 * Every outbound merchant link on the site goes through `affiliateUrl()`.
 * Affiliation is done in the browser by Sovrn Commerce (VigLink): its script
 * (components/VigLink.tsx, inlined as Sovrn gives it; components/VigLink.tsx) rewrites
 * supported merchant links when clicked, so links are rendered here unchanged.
 *
 * Amazon and eBay links are the exception: affiliateUrl() routes them through
 * Geniuslink (server-side, no browser script), and Sovrn handles every other
 * retailer (user request, 17 Oct 2026). The Geniuslink browser snippet stays off
 * so only one tool rewrites any given click. AFFILIATE_ENABLED is true while
 * either is configured, so commission notices appear only while one is on.
 */

export type Network = 'direct';

/** Geniuslink TSID (from Tools > Embed Geniuslink in your Website). Public; empty switches Geniuslink off. */
const GENIUSLINK_TSID = (process.env.NEXT_PUBLIC_GENIUSLINK_TSID ?? '').trim();
const GENIUSLINK_BASE = (process.env.NEXT_PUBLIC_GENIUSLINK_BASE_URL || 'https://buy.geni.us').replace(/\/+$/, '');
const GENIUSLINK_DTB = process.env.NEXT_PUBLIC_GENIUSLINK_PRESERVE_EXISTING === 'true';
/** Already a Geniuslink/GeoRiot link: leave it alone. */
const GENIUSLINK_HOST = /(^|\.)(geni\.us|georiot\.com)$/i;
/**
 * Only Amazon and eBay go through Geniuslink's Proxy.ashx. Every other host got a 403
 * "unsupported hostname" page when tested (6 Oct 2026), and Sovrn covers those retailers.
 */
const GENIUSLINK_MERCHANT = /(^|\.)(amazon\.[a-z.]+|ebay\.[a-z.]+)$/i;
export const GENIUSLINK_ENABLED = /^\d+$/.test(GENIUSLINK_TSID);

/**
 * Sovrn Commerce (VigLink) publisher key. It is public (it ships in every page),
 * so a default lives here; NEXT_PUBLIC_VIGLINK_KEY overrides it, and setting
 * that to an empty value switches VigLink off at the next build.
 */
export const VIGLINK_KEY = (process.env.NEXT_PUBLIC_VIGLINK_KEY ?? '20be2ac7ea01bfc9ab29775bb26552ee').trim();

export interface AffiliateOptions {
  /** Kept for compatibility with existing components. Links are no longer wrapped here. */
  network?: Network;
  subId?: string;
}

/** Links are handled directly. */
export function detectNetwork(rawUrl: string): Network {
  void rawUrl;
  return 'direct';
}

/**
 * Amazon and eBay URLs go through Geniuslink's Proxy.ashx. Any other retailer comes back
 * unchanged, and VigLink affiliates it in the browser. No TSID or a bad URL: unchanged too.
 */
export function affiliateUrl(rawUrl: string, options: AffiliateOptions = {}): string {
  void options;
  if (!GENIUSLINK_ENABLED) return rawUrl;
  let host: string;
  try {
    const u = new URL(rawUrl);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return rawUrl;
    host = u.hostname;
  } catch {
    return rawUrl;
  }
  if (GENIUSLINK_HOST.test(host) || !GENIUSLINK_MERCHANT.test(host)) return rawUrl;
  return `${GENIUSLINK_BASE}/Proxy.ashx?TSID=${GENIUSLINK_TSID}&GR_URL=${encodeURIComponent(rawUrl)}${GENIUSLINK_DTB ? '&dtb=1' : ''}`;
}

const A_TAG = /<a\b[^>]*>/gi;
const HREF_ATTR = /\shref\s*=\s*(["'])(.*?)\1/i;
const REL_TARGET_ATTR = /\s(?:rel|target)\s*=\s*(["']).*?\1/gi;
/**
 * The stores in the merchant list, by their shop host only (help., catalogue.
 * and brand sites such as apple.com stay plain: articles cite those as sources).
 * Sovrn affiliates these on click, so in-text links to them are paid links.
 */
const RETAILER_HOST =
  /^(?:www\.)?(?:(?:jbhifi|thegoodguys|bunnings|harveynorman|officeworks|bigw|binglee|dicksmith|domayne|jaycar|kmart|mobileciti|mwave|scorptec|videopro|beaconlighting|appliancesonline|woolworths|reebelo)\.com\.au|kogan\.com)$/i;

/**
 * Affiliate handling for every link in an HTML fragment: article bodies,
 * product descriptions, research notes and CMS pages carry hand-written links
 * that never pass through AffiliateLink. Amazon/eBay go through affiliateUrl();
 * those and links to the retailers Sovrn affiliates get the buy-button
 * target/rel. Every other link is left as it is.
 */
export function affiliateHtmlLinks(html: string): string {
  if (!AFFILIATE_ENABLED || !html) return html;
  return html.replace(A_TAG, (tag) => {
    const m = tag.match(HREF_ATTR);
    if (!m) return tag;
    const raw = m[2].replace(/&amp;/g, '&');
    const out = affiliateUrl(raw);
    if (out === raw) {
      let host = '';
      try {
        host = new URL(raw).hostname;
      } catch {
        return tag;
      }
      if (!VIGLINK_KEY || !RETAILER_HOST.test(host)) return tag;
    }
    return tag
      .replace(m[0], ` href="${out.replace(/&/g, '&amp;')}"`)
      .replace(REL_TARGET_ATTR, '')
      .replace(/^<a\b/i, `<a target="${affiliateLinkAttrs.target}" rel="${affiliateLinkAttrs.rel}"`);
  });
}

/** Whether an HTML fragment holds a paid link (run affiliateHtmlLinks first). */
export const hasSponsoredLink = (html: string): boolean => /\srel="sponsored\b/i.test(html);

/**
 * Which networks are live. Surfaced on /affiliate-disclosure/ so the disclosure page
 * always matches reality instead of drifting out of date.
 */
export function configuredNetworks(): string[] {
  const live: string[] = [];
  if (GENIUSLINK_ENABLED) live.push('Geniuslink (Amazon and eBay)');
  if (VIGLINK_KEY) live.push('Sovrn Commerce (VigLink)');
  return live;
}

/**
 * Whether each script actually loads (components/HeadScripts.tsx uses the same
 * tests). The cookie banner and /cookies/ describe only what is on, so the
 * copy never claims tracking the site is not doing. No server-only imports:
 * the cookie banner (a client component) reads these.
 */
/** Any affiliate tracking at all. Off: every "we may earn a commission" notice is hidden. */
export const AFFILIATE_ENABLED = GENIUSLINK_ENABLED || Boolean(VIGLINK_KEY);

/** Attributes every outbound commercial link must carry. */
export const affiliateLinkAttrs = {
  target: '_blank',
  rel: 'sponsored nofollow noopener noreferrer',
} as const;
