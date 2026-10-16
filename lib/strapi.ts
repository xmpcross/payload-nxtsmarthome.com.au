/**
 * Posts, from the CMS.
 *
 * The site read 48 markdown files from content/articles/ until this existed.
 * Strapi held a copy, pushed one way by scripts/strapi-import.mjs, which meant
 * publishing in the CMS changed nothing on the site and the two drifted — 48
 * files against 26 documents by the time anyone checked.
 *
 * Strapi is now the source. The markdown is kept in git as history, not read.
 *
 * Everything here returns the shape lib/content.ts already produced, so the
 * components consuming articles did not have to change.
 */

const BASE = (process.env.SITE_URL || 'https://nxtsmarthome.com.au').replace(/\/$/, '');
const TOKEN = process.env.STRAPI_TOKEN || process.env.STRAPI_API_TOKEN || '';

/**
 * The CMS and the site name article types differently — the CMS vocabulary grew
 * from the shared multi-site schema, the site's from its own routing. Mapped
 * rather than renamed on either side, because both are in use elsewhere.
 */
const POST_TYPE: Record<string, string> = {
  'how-to-guide': 'how-to',
  'product-comparison': 'comparison',
  'product-roundup': 'roundup',
  informative: 'explainer',
  'buying-guide': 'buying-guide',
  pillar: 'pillar',
  review: 'review',
};

export interface StrapiPost {
  slug: string;
  title: string;
  excerpt?: string;
  /** Search-result title and description; the H1 (title) and excerpt are the fallback. */
  seoTitle?: string | null;
  seoDescription?: string | null;
  content?: string;
  postType?: string;
  publishDate?: string;
  /** Release date: a future value keeps the post hidden until then (see publishedCutoff). */
  showFrom?: string | null;
  dateModified?: string;
  keyTakeaways?: string;
  coverImage?: { url?: string; alternativeText?: string } | null;
  coverImageUrl?: string;
  coverImageAlt?: string;
  /** Extra images generated with the article (Payload upload, hasMany). */
  gallery?: Array<{ url?: string; alt?: string; alternativeText?: string; width?: number; height?: number } | number> | null;
  tags?: string[];
  featured?: boolean;
  readingTimeMinutes?: number;
  faq?: { q?: string; question?: string; a?: string; answer?: string }[];
  categories?: { name?: string; slug?: string }[];
  author?: { name?: string; slug?: string } | null;
  publishedAt?: string;
}

export function articleType(postType?: string): string {
  return POST_TYPE[String(postType ?? '')] ?? 'explainer';
}

/** Absolute URL for a Strapi media path, which comes back root-relative. */
export function mediaUrl(url?: string | null): string {
  if (!url) return '';
  return url;
}

/**
 * Every published post.
 *
 * Asks for `status=published` explicitly. Without it Strapi 5 returns the draft
 * version of each document, whose publishedAt is null whether or not it is live
 * — the same trap that made the CMS dashboard report every row as a draft.
 */
/*
 * One value per build process, appended to the CMS query.
 *
 * Next keys its fetch cache on the URL, and that cache survives in .next/cache
 * between builds. A cover uploaded four minutes before a rebuild was therefore
 * served from cache, so the build baked the OLD image and it looked as though
 * the upload had failed. cache: 'no-store' is the obvious fix but output:
 * 'export' refuses to build an uncached fetch, so the URL changes instead.
 */
const BUILD_STAMP = String(Date.now());

/*
 * Scheduled publishing.
 *
 * `showFrom` is a datetime field on nxtsmarthome-post. A post whose showFrom
 * is in the future is queued: written and Published in Strapi, but invisible
 * here until that moment passes. Empty showFrom = an ordinary post. (Strapi's
 * own publishedAt is a system field, and timed publishing is a paid Strapi
 * feature.) The AI writer sets it with --publishedAt; editors can set it in
 * the admin.
 *
 * The gate is in the query, so every channel (pages, listings, sitemap)
 * inherits it. The cutoff is floored to the minute because it is part of the
 * fetch cache key; with ISR (5 min) a queued post appears within ~5 minutes of
 * its time. SHOW_SCHEDULED_POSTS=1 (server-side) shows the queue in a preview.
 */
const SHOW_SCHEDULED = process.env.SHOW_SCHEDULED_POSTS === '1';

/** Now, floored to the minute, as an ISO string. */
export function publishedCutoff(): string {
  const now = Date.now();
  return new Date(now - (now % 60_000)).toISOString();
}

export async function listPosts(): Promise<StrapiPost[]> {
  const { cmsDocuments } = await import('./cms');
  return await cmsDocuments('posts', { includeScheduled: SHOW_SCHEDULED }) as unknown as StrapiPost[];
}
