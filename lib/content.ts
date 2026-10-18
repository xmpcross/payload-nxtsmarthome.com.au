import fs from 'node:fs';
import path from 'node:path';
import { articleType, listPosts, mediaUrl, type StrapiPost } from './strapi';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeStringify from 'rehype-stringify';
import { categories, getCategoryByKey, type Category } from './site';
import { editorialHits, guardMode, postTexts } from './editorial-guard.mjs';
import { mergedSlugTargets } from './merged-articles.mjs';
import { articleHref } from './urls';


/** The kinds of article this site publishes. Drives the badge and the JSON-LD type. */
export type ArticleType =
  | 'review'
  | 'comparison'
  | 'buying-guide'
  | 'how-to'
  | 'explainer'
  | 'roundup'
  /** Hub page that links down to a cluster of supporting articles. */
  | 'pillar';

export interface RetailerLink {
  /** Display name, e.g. "JB Hi-Fi". */
  name: string;
  /** Raw merchant URL — the affiliate wrapper is applied at render time. */
  url: string;
  /** Optional price string as seen at time of writing, e.g. "A$249". */
  price?: string;
  /**
   * Render as a full button. Everything else becomes a compact secondary link, so
   * a product stocked at seven retailers does not turn into a wall of buttons.
   */
  primary?: boolean;
}

export interface ProductRef {
  name: string;
  brand?: string;
  /** One-line summary of who it suits. */
  bestFor?: string;
  rating?: number;
  pros?: string[];
  cons?: string[];
  retailers?: RetailerLink[];
  image?: string;
}

export interface FaqItem {
  q: string;
  a: string;
}

export interface ArticleFrontmatter {
  title: string;
  description: string;
  category: string;
  type: ArticleType;
  date: string;
  updated?: string;
  author?: string;
  tags?: string[];
  featured?: boolean;
  draft?: boolean;
  image?: string;
  imageAlt?: string;
  /** The cover's media caption, e.g. "AI-generated illustration"; shown under the cover. */
  imageCaption?: string;
  /** Gallery images saved with the post, shown inside the article body. */
  gallery?: { src: string; alt?: string; caption?: string; width?: number; height?: number }[];
  /** Short takeaway rendered in a callout at the top of the article. */
  keyTakeaway?: string;
  products?: ProductRef[];
  faq?: FaqItem[];
  /** Drafted with the AI article writer; the article page says so above the body (content audit C10). */
  aiDrafted?: boolean;
}

export interface Article extends ArticleFrontmatter {
  slug: string;
  /** Rendered HTML body. */
  html: string;
  /** Raw markdown body, used for the search index and excerpts. */
  raw: string;
  readingMinutes: number;
  wordCount: number;
  headings: Heading[];
  categoryMeta: Category | undefined;
  /**
   * <title> and meta description, from the CMS seoTitle / seoDescription.
   * The H1 can run long; search results show about 60 characters (audit S4/S5).
   */
  seoTitle?: string;
  seoDescription?: string;
}

export interface Heading {
  id: string;
  text: string;
  level: number;
}

/** Article shape without the rendered body — cheap to pass into list components. */
export type ArticleSummary = Omit<Article, 'html' | 'raw' | 'headings'>;

/*
 * Per-process memo of the built article list. The site runs on `next start`,
 * where a module-level cache lives as long as the server — so it must expire,
 * or ISR regenerations keep rebuilding pages from the list fetched at boot and
 * new Strapi posts never appear. A minute is enough to share one fetch across
 * a build or a burst of regenerations; the fetch itself is cached for 5
 * minutes by Next's data cache (lib/strapi.ts).
 */
const CACHE_TTL_MS = 60_000;
let cache: { at: number; articles: Article[] } | null = null;

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function extractHeadings(markdown: string): Heading[] {
  const headings: Heading[] = [];
  // Ignore anything inside fenced code blocks so ``` # comments ``` are not treated as headings.
  const withoutCode = markdown.replace(/```[\s\S]*?```/g, '');
  const re = /^(#{2,3})\s+(.+)$/gm;
  let match: RegExpExecArray | null;
  while ((match = re.exec(withoutCode)) !== null) {
    const level = match[1].length;
    const text = match[2].replace(/[*_`]/g, '').trim();
    headings.push({ id: slugify(text), text, level });
  }
  return headings;
}

/*
 * In-body links to our own articles, made canonical before rendering (audit
 * S1): stored links use the category KEY (/security/<slug>), which
 * 308-redirects to /security-and-cameras/<slug>/. Relative or absolute, the
 * key becomes the URL slug and the trailing slash is added.
 */
const KEY_PATH = new RegExp(
  String.raw`\]\((?:https?://(?:www\.)?nxtsmarthome\.com\.au)?/(` +
    categories.filter((c) => c.key !== c.slug).map((c) => c.key).join('|') +
    String.raw`)/([a-z0-9-]+)/?(#[^)\s]*)?\)`,
  'g',
);

export function canonicaliseArticleLinks(markdown: string): string {
  const merged = mergedSlugTargets();
  const out = markdown.replace(KEY_PATH, (_m, key: string, slug: string, hash?: string) => {
    const cat = categories.find((c) => c.key === key);
    return `](/${cat ? cat.slug : key}/${slug}/${hash ?? ''})`;
  });
  // A link to a merged-away article goes straight to its survivor, not via the 301.
  if (!merged.size) return out;
  return out.replace(
    /\]\((?:https?:\/\/(?:www\.)?nxtsmarthome\.com\.au)?\/[a-z0-9-]+\/([a-z0-9-]+)\/?(#[^)\s]*)?\)/g,
    (m, slug: string, hash?: string) => {
      const to = merged.get(slug);
      return to ? `](${to}${hash ?? ''})` : m;
    },
  );
}

/*
 * Render-time normalisation of every internal href in an article body (audit
 * H3). The markdown pass above only sees `](…)` links that use a category key;
 * bodies also carry raw <a href> HTML, links without the trailing slash,
 * `//` doubled slashes, /product/<slug> (singular) and absolute links to this
 * domain. Each of those costs a redirect hop. Rewritten here, after rendering,
 * so markdown and raw HTML links are handled alike:
 *
 *   - this domain (http/https, with or without www) becomes a root-relative path
 *   - repeated slashes collapse, and a page path gets exactly one trailing slash
 *   - /<category-key>/<slug> becomes /<category-slug>/<slug>/ (security ->
 *     security-and-cameras, etc. — the article route 308s the key form)
 *   - /product/<slug> becomes /products/<slug>/ (next.config.mjs redirect)
 *   - /<any-category>/<article-slug> for a known article becomes that article's
 *     canonical path, and a merged-away slug its survivor — the article route
 *     resolves by slug and redirects anything else there
 *
 * Left alone: external URLs, protocol-relative URLs, mailto:/tel:, anchors
 * (#…), query-only hrefs (?…), and paths ending in a file extension.
 */
const OWN_ORIGIN = /^https?:\/\/(?:www\.)?nxtsmarthome\.com\.au(?=[/?#]|$)/i;
const KEY_TO_SLUG = new Map<string, string>(categories.filter((c) => c.key !== c.slug).map((c) => [c.key, c.slug]));
const ARTICLE_PREFIXES = new Set(['articles', ...categories.map((c) => c.slug), ...categories.map((c) => c.key)]);

/**
 * Canonical form of one internal href. `articlePaths` maps an article slug to
 * its canonical path (live articles plus merged-away slugs); without it only
 * the shape-level fixes apply.
 */
export function normaliseInternalHref(href: string, articlePaths?: Map<string, string>): string {
  const raw = href.trim();
  let rest: string;
  if (OWN_ORIGIN.test(raw)) rest = raw.replace(OWN_ORIGIN, '');
  else if (raw.startsWith('/') && !raw.startsWith('//')) rest = raw;
  else return href;

  const split = rest.match(/^([^?#]*)([\s\S]*)$/);
  const pathname = split?.[1] ?? '';
  const suffix = split?.[2] ?? '';
  const segments = pathname.split('/').filter(Boolean);
  if (!segments.length) return `/${suffix}`;

  // A file (/feed.xml, /images/x.webp, /ads.txt): no trailing slash.
  if (/\.[a-z0-9]{1,5}$/i.test(segments[segments.length - 1])) return `/${segments.join('/')}${suffix}`;

  if (segments.length === 2 && segments[0] === 'product') {
    segments[0] = 'products';
  } else if (segments.length === 2 && ARTICLE_PREFIXES.has(segments[0])) {
    const known = articlePaths?.get(segments[1]);
    if (known) return `${known}${suffix}`;
    segments[0] = KEY_TO_SLUG.get(segments[0]) ?? segments[0];
  }
  return `/${segments.join('/')}/${suffix}`;
}

/** Apply normaliseInternalHref to every href in a rendered HTML fragment. */
export function normaliseInternalLinks(html: string, articlePaths?: Map<string, string>): string {
  return (
    html
      // Generation artefact: JSON-escaped quotes (href=\"…\") stored in the
      // body made browsers resolve the link relative to the page (audit H2).
      .replace(/(\shref=)\\"([^"\\]*)\\"/gi, '$1"$2"')
      .replace(/(\shref=)(["'])([^"']*)\2/gi, (_m, attr: string, quote: string, value: string) => {
        // Entity-encoded ampersands survive untouched: the suffix is copied verbatim.
        return `${attr}${quote}${normaliseInternalHref(value, articlePaths)}${quote}`;
      })
  );
}

async function renderMarkdown(markdown: string): Promise<string> {
  markdown = canonicaliseArticleLinks(markdown);
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeSlug)
    .use(rehypeAutolinkHeadings, { behavior: 'wrap' })
    .use(rehypeStringify, { allowDangerousHtml: true })
    .process(markdown);
  return String(file);
}

/**
 * A Strapi document, in the shape the rest of this file already produced.
 *
 * The CMS stores the body as markdown, so it goes through exactly the same
 * renderMarkdown pipeline the files did — headings keep their anchors and the
 * article HTML is byte-identical for identical source.
 *
 * Two fields need translating rather than copying. The CMS names article types
 * from the shared multi-site schema (`informative`, `product-roundup`), which
 * articleType() maps to this site's vocabulary. And the CMS relates a post to a
 * category by URL slug, while every component here keys off the category KEY —
 * `security`, not `security-and-cameras`.
 */
function categoryKeyFromSlug(slug?: string): string {
  if (!slug) return '';
  const hit = categories.find((c) => c.slug === slug || c.key === slug);
  return hit?.key ?? '';
}

async function fromStrapi(post: StrapiPost): Promise<Article | null> {
  if (!post?.slug || !post.title) return null;

  const body = String(post.content ?? '');
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  const categoryKey = categoryKeyFromSlug(post.categories?.[0]?.slug);

  return {
    title: post.title,
    description: post.excerpt ?? '',
    seoTitle: post.seoTitle?.trim() || undefined,
    seoDescription: post.seoDescription?.trim() || undefined,
    category: categoryKey,
    type: articleType(post.postType) as Article['type'],
    // A scheduled post dates from its release (showFrom), not from when it was written.
    date: post.showFrom ?? post.publishDate ?? post.publishedAt ?? '',
    updated: post.dateModified || undefined,
    aiDrafted: post.source === 'ai',
    /*
     * The CMS author when the post has one, by slug so resolveAuthor matches a
     * file in content/authors/ and the byline links to a real profile. Posts
     * with no author set still fall back to the editorial byline.
     */
    author: post.author?.slug ?? post.author?.name ?? 'NXT Smart Home',
    tags: Array.isArray(post.tags) ? post.tags : [],
    featured: Boolean(post.featured),
    /*
     * The uploaded media wins over coverImageUrl. Content Manager's image
     * picker writes the media relation, so reading only the string field meant
     * an upload changed nothing — and on at least one post coverImageUrl held a
     * URL pointing back at this site's own /covers/ file, so the upload lost to
     * the very asset it was meant to replace.
     */
    image: mediaUrl(post.coverImage?.url) || post.coverImageUrl || undefined,
    imageAlt: post.coverImageAlt || post.coverImage?.alternativeText || undefined,
    imageCaption: post.coverImage?.caption || undefined,
    // Unpopulated (id-only) or file-less entries are skipped.
    gallery: (post.gallery ?? [])
      .filter((m): m is Exclude<typeof m, number> => Boolean(m && typeof m === 'object' && m.url))
      .map((m) => ({ src: mediaUrl(m.url), alt: m.alt || m.alternativeText || undefined, caption: m.caption || undefined, width: m.width, height: m.height })),
    keyTakeaway: post.keyTakeaways || undefined,
    faq: (post.faq ?? [])
      .map((f) => ({ q: f.q ?? f.question ?? '', a: f.a ?? f.answer ?? '' }))
      .filter((f) => f.q && f.a),
    slug: post.slug,
    html: await renderMarkdown(body),
    raw: body,
    wordCount: words,
    // From the word count at 225wpm. The CMS's readingTimeMinutes was stale
    // (a 3,800-word guide showed "6 min read"), so it is no longer used.
    readingMinutes: Math.max(1, Math.round(words / 225)),
    headings: extractHeadings(body),
    categoryMeta: getCategoryByKey(categoryKey),
  } as Article;
}

/*
 * Posts the site publishes in Strapi but does not serve.
 *
 *   - Unfinished: body, excerpt, key takeaways or FAQ still carries a [VERIFY]
 *     fact-check tag or a template placeholder (lib/editorial-guard.mjs). They
 *     come back on their own once the markers are cleared in Strapi.
 *   - Merged: a near-duplicate folded into another article
 *     (data/merged-articles.json). The article route 301s these.
 *
 * Held back here, before anything is built, so every channel that reads
 * getAllArticles (pages, listings, categories, related posts, authors, the
 * sitemap) drops them in one place. getArticle then misses, so the page 404s.
 */
let lastHeldBack = '';

/**
 * Editorial markers left in a published post: "[VERIFY", "TODO", "TBD",
 * "lorem ipsum", template placeholders. Checks body, excerpt, key takeaways
 * and every FAQ question and answer, case-insensitive (lib/editorial-guard.mjs).
 * Returns one "<marker> x<count>" string per marker found; empty when clean.
 */
export function editorialIssues(post: StrapiPost): string[] {
  return editorialHits(postTexts(post)).map((h) => `${h.label} x${h.count}`);
}

function withoutHeldBack(posts: StrapiPost[]): StrapiPost[] {
  const merged = mergedSlugTargets();
  const mode = guardMode();
  const flagged: string[] = [];
  const kept = posts.filter((post) => {
    if (merged.has(post.slug)) return false;
    const issues = editorialIssues(post);
    if (!issues.length) return true;
    flagged.push(`${post.slug}: ${issues.join(', ')}`);
    // EDITORIAL_GUARD=warn keeps the post live; the log still names it.
    return mode === 'warn';
  });

  // Logged when the set changes, not on every one-minute cache refresh.
  const summary = `${mode}\n${flagged.join('\n')}`;
  if (summary !== lastHeldBack) {
    lastHeldBack = summary;
    if (flagged.length) {
      console.warn(
        `[editorial-guard] ${mode === 'warn' ? 'WARN (EDITORIAL_GUARD=warn, still live)' : 'blocking'} ` +
          `${flagged.length} post(s) with editorial markers:\n  ${flagged.join('\n  ')}`,
      );
    }
  }
  return kept;
}

/** Survivor path for a merged-away article slug, if it was merged. */
export function mergedInto(slug: string): string | undefined {
  return mergedSlugTargets().get(slug);
}

/** All published articles, newest first. Cached for the duration of the build. */
export async function getAllArticles(): Promise<Article[]> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.articles;

  const posts = withoutHeldBack(await listPosts());
  const built = await Promise.all(posts.map(fromStrapi));

  const articles = built
    .filter((a): a is Article => a !== null)
    .sort((a, b) => +new Date(b.date) - +new Date(a.date));

  // Internal links in each body, made canonical now that every article's path
  // is known: merged-away slugs first, so a live article of the same slug wins.
  const articlePaths = new Map<string, string>(mergedSlugTargets());
  for (const a of articles) articlePaths.set(a.slug, articleHref(a));
  for (const a of articles) a.html = normaliseInternalLinks(a.html, articlePaths);

  cache = { at: Date.now(), articles };

  return articles;
}

export async function getArticle(slug: string): Promise<Article | undefined> {
  const all = await getAllArticles();
  return all.find((a) => a.slug === slug);
}

export async function getArticlesByCategory(categoryKey: string): Promise<Article[]> {
  const all = await getAllArticles();
  return all.filter((a) => a.category === categoryKey);
}

export async function getArticlesByTag(tag: string): Promise<Article[]> {
  const all = await getAllArticles();
  return all.filter((a) => (a.tags ?? []).some((t) => slugify(t) === tag));
}

export async function getAllTags(): Promise<{ tag: string; slug: string; count: number }[]> {
  const all = await getAllArticles();
  const counts = new Map<string, { tag: string; count: number }>();
  for (const article of all) {
    for (const tag of article.tags ?? []) {
      const key = slugify(tag);
      const existing = counts.get(key);
      if (existing) existing.count += 1;
      else counts.set(key, { tag, count: 1 });
    }
  }
  return [...counts.entries()]
    .map(([slug, v]) => ({ slug, tag: v.tag, count: v.count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

export async function getFeaturedArticles(limit = 4): Promise<Article[]> {
  const all = await getAllArticles();
  const featured = all.filter((a) => a.featured);
  // Top up with the newest articles if not enough are flagged featured.
  const rest = all.filter((a) => !a.featured);
  return [...featured, ...rest].slice(0, limit);
}

/**
 * Related articles, ranked by shared tags then same category.
 * Falls back to recent articles so the slot is never empty on a young site.
 */
export async function getRelatedArticles(article: Article, limit = 3): Promise<Article[]> {
  const all = await getAllArticles();
  const others = all.filter((a) => a.slug !== article.slug);
  const tags = new Set((article.tags ?? []).map(slugify));

  const scored = others.map((candidate) => {
    let score = 0;
    if (candidate.category === article.category) score += 3;
    for (const tag of candidate.tags ?? []) {
      if (tags.has(slugify(tag))) score += 2;
    }
    return { candidate, score };
  });

  return scored
    .sort((a, b) => b.score - a.score || +new Date(b.candidate.date) - +new Date(a.candidate.date))
    .slice(0, limit)
    .map((s) => s.candidate);
}

/**
 * Related articles with a real relevance figure attached.
 *
 * The percentage is derived from the same signals used to rank them — same
 * category scores 3, each shared tag scores 2 — expressed against the best score
 * in the set. It is a genuine measure of how related two articles are, not a
 * decorative "100% match" badge.
 */
export async function getRelatedWithScores(
  article: Article,
  limit = 3,
): Promise<{ article: Article; match: number }[]> {
  const all = await getAllArticles();
  const others = all.filter((a) => a.slug !== article.slug);
  const tags = new Set((article.tags ?? []).map(slugify));

  const scored = others.map((candidate) => {
    let score = 0;
    if (candidate.category === article.category) score += 3;
    for (const tag of candidate.tags ?? []) {
      if (tags.has(slugify(tag))) score += 2;
    }
    return { article: candidate, score };
  });

  const top = scored
    .sort((a, b) => b.score - a.score || +new Date(b.article.date) - +new Date(a.article.date))
    .slice(0, limit);

  const best = Math.max(1, ...top.map((t) => t.score));
  return top.map((t) => ({
    article: t.article,
    // Floor at 40% so a weak-but-shown suggestion is not advertised as 0%.
    match: Math.max(40, Math.round((t.score / best) * 100)),
  }));
}

/** Strip markdown down to plain text — used for search snippets. */
export function toPlainText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`|-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Shape of one entry in public/search-index.json.
 * The file itself is generated by scripts/build-search-index.mjs during `prebuild`.
 */
export interface SearchDoc {
  categoryMeta?: { slug: string };
  slug: string;
  title: string;
  description: string;
  category: string;
  categoryName: string;
  type: string;
  date: string;
  tags: string[];
  body: string;
  /* Emitted by scripts/build-search-index.mjs but previously undeclared, so
     anything reading them failed to typecheck. */
  cover?: string;
  readingMinutes?: number;
}

/**
 * Cover image for an article. Falls back to the generated branded cover in
 * public/covers/ — the site has no photography, and a magazine layout with empty
 * image slots looks broken. Replace with a real photo by setting `image` in the
 * article front matter; that always wins.
 */
export { articleHref } from './urls';

/**
 * First existing file from `candidates`, cache-busted by its own content.
 *
 * Covers keep the same filename when regenerated and nginx serves images with
 * max-age=2592000 — without the ?v= hash a regenerated cover stays invisible in
 * browsers and at the CDN edge for up to 30 days.
 */
function assetUrl(candidates: string[], fallback: string): string {
  for (const rel of candidates) {
    try {
      const { size, mtimeMs } = fs.statSync(path.join(process.cwd(), 'public', rel));
      const v = (size ^ Math.round(mtimeMs)).toString(36).slice(-6);
      return `/${rel}?v=${v}`;
    } catch {
      /* try the next one */
    }
  }
  return fallback;
}

/**
 * 500x500 product-centred crop of the same artwork, written alongside the wide
 * cover by scripts/compose-cover.py.
 *
 * Used wherever the cover is shown small and square. The wide cover has the
 * headline baked into its left half, so cropping it to a thumbnail shows a slab
 * of unreadable type; this variant is centred on the product instead.
 *
 * Falls back to the wide cover when no square exists yet, so an article without
 * one still renders.
 */
export function squareCoverFor(article: { slug: string; image?: string }): string {
  if (article.image) return article.image;
  return assetUrl(
    [`covers/square/${article.slug}.webp`, `covers/square/${article.slug}.png`],
    coverFor(article),
  );
}

export function coverFor(article: { slug: string; image?: string }): string {
  if (article.image) return article.image;
  // WebP is what the composer writes now; the PNG entry keeps any cover that has
  // not been regenerated yet working.
  return assetUrl(
    [`covers/${article.slug}.webp`, `covers/${article.slug}.png`],
    `/covers/${article.slug}.png`,
  );
}

/**
 * Hero banner for a category, written by scripts/generate-category-hero.mjs.
 *
 * Returns null when that category has no banner yet, so a page can fall back to
 * its plain text header rather than rendering a broken image. Banners are
 * generated one category at a time and cost credits, so "not generated yet" is
 * the normal state for most of them, not an error.
 *
 * `kind` picks the set: 'product' for /products/category/<slug>/, 'post' for
 * /categories/<slug>/. The two are different artwork on purpose.
 */
export function categoryHeroFor(slug: string, kind: 'post' | 'product'): string | null {
  return assetUrl([`heroes/${kind}/${slug}.webp`], '') || null;
}

export function categoriesWithCounts(articles: Article[]) {
  return categories.map((category) => ({
    ...category,
    count: articles.filter((a) => a.category === category.key).length,
  }));
}

export const typeLabels: Record<ArticleType, string> = {
  review: 'Review',
  comparison: 'Comparison',
  'buying-guide': 'Buying Guide',
  'how-to': 'How-To',
  explainer: 'Explainer',
  roundup: 'Roundup',
  pillar: 'Complete Guide',
};

export function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export { slugify };
