/**
 * Affiliate link layer.
 *
 * Every outbound merchant link on the site goes through `affiliateUrl()`.
 * Affiliation is done in the browser by Sovrn Commerce (VigLink), added on
 * 17 Oct 2026 (user request): its script (public/js/viglink-init.js, loaded by
 * components/VigLink.tsx) rewrites supported merchant links when clicked, so
 * links are rendered here unchanged. Geniuslink was removed earlier the same
 * day. AFFILIATE_ENABLED follows whether the VigLink key is set, so commission
 * notices appear only while the script is on.
 */

export type Network = 'direct';

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

/** The retailer URL, unchanged: VigLink affiliates it in the browser. */
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
export const AFFILIATE_ENABLED = Boolean(VIGLINK_KEY);

/** Attributes every outbound commercial link must carry. */
export const affiliateLinkAttrs = {
  target: '_blank',
  rel: 'sponsored nofollow noopener noreferrer',
} as const;
