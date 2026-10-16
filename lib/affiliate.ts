/**
 * Affiliate link layer.
 *
 * Every outbound merchant link on the site goes through `affiliateUrl()`.
 * There is no affiliate integration at present: Geniuslink was removed on
 * 17 Oct 2026 (user request), after Sovrn and Takeads on 6 Oct 2026, so links
 * go to the retailer unchanged and every "we may earn a commission" notice is
 * hidden (AFFILIATE_ENABLED). To add a network, wrap URLs in affiliateUrl(),
 * list it in configuredNetworks() and set AFFILIATE_ENABLED from its config.
 */

export type Network = 'direct';

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

/** The retailer URL, unchanged: no affiliate network is configured. */
export function affiliateUrl(rawUrl: string, options: AffiliateOptions = {}): string {
  void options;
  return rawUrl;
}

/**
 * Which networks are live. Surfaced on /affiliate-disclosure/ so the disclosure page
 * always matches reality instead of drifting out of date.
 */
export function configuredNetworks(): string[] {
  const live: string[] = [];
  return live;
}

/**
 * Whether each script actually loads (components/HeadScripts.tsx uses the same
 * tests). The cookie banner and /cookies/ describe only what is on, so the
 * copy never claims tracking the site is not doing. No server-only imports:
 * the cookie banner (a client component) reads these.
 */
/** Any affiliate tracking at all. Off: every "we may earn a commission" notice is hidden. */
export const AFFILIATE_ENABLED = false;

/** Attributes every outbound commercial link must carry. */
export const affiliateLinkAttrs = {
  target: '_blank',
  rel: 'sponsored nofollow noopener noreferrer',
} as const;
