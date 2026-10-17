import { catalogue } from './catalogue';
import { reviewSummary } from './review-sources';
/**
 * Shared product library.
 *
 * Reads products, offers and curated editorial from local Payload/PostgreSQL.
 * Original JSON and Markdown files are retained only as migration archives.
 */
import type { ProductRef, RetailerLink } from './content';


export interface Product extends ProductRef {
  slug: string;
  /** Every string an article might use to name this product. Drives auto-detection. */
  match: string[];
  /** Stable ids so links can be rebuilt and enrichment has somewhere to write. */
  identifiers?: {
    model?: string;
    asin?: string;
    ebayEpid?: string;
    gtin?: string;
  };
  /** Body copy below the front matter — a short editorial note. */
  note?: string;
  categoryKey?: string;
  categorySlug?: string;
  categoryName?: string;
  priceAud?: number;
  reviewCount?: number;
}

export interface TopProductRetailer {
  name: string;
  url: string;
  primary?: boolean;
  priceAud?: number;
  logo?: string;
  /** True when `url` points at the retailer's product page, not a search. */
  deepLink?: boolean;
  /** Daily price checks, oldest first (written by scripts/commerce, one point per Sydney day). */
  history?: { d: string; p: number }[];
}

/**
 * A single customer review. Nothing in the current dataset populates this —
 * these fields exist so the reviews section can light up the moment real
 * review data is imported from a retailer feed. Never populate them by hand:
 * an invented review with a name and a "verified purchaser" badge is a fake
 * review, which the ACCC treats as misleading conduct.
 */
export interface ProductReview {
  id: string;
  title?: string;
  body: string;
  rating: number;
  author?: string;
  postedAt?: string;
  badges?: string[];
  sourceLabel?: string;
  sourceUrl?: string;
  images?: string[];
}

export interface TopProduct {
  editorial?: Partial<Product> & { enabled?: boolean };
  id: string;
  slug: string;
  name: string;
  brand: string;
  categoryKey: string;
  categorySlug: string;
  categoryName: string;
  subCategory?: string;
  bestFor?: string;
  rating?: number;
  reviewCount?: number;
  priceAud?: number;
  currency?: string;
  image?: string;
  retailers: TopProductRetailer[];
  pros?: string[];
  cons?: string[];
  updatedAt?: string;
  /** Manufacturer description from the Google Shopping catalogue. */
  description?: string;
  /**
   * Editorial blurb, written in the CMS and synced in by
   * scripts/fetch-product-descriptions.mjs. Preferred over `description`, which
   * is merchant copy and stays as the fallback for anything not yet rewritten.
   */
  shortDescription?: string;
  /**
   * The CMS long description, already converted from markdown to HTML by the
   * same sync. Converted at build time rather than in the component: the panel
   * that renders it is a client component, and the remark stack is server-only.
   */
  cmsDescriptionHtml?: string;
  /** Google Shopping catalogue id — the only external identifier available. */
  googleProductId?: string;
  gtin?: string;
  mpn?: string;
  /** Real specifications from the Google Shopping catalogue. */
  specifications?: Array<{ name: string; value: string }>;
  /** When retailer prices were last verified against the catalogue. */
  pricesCheckedAt?: string;
  /** Star histogram, keyed 1–5. Absent unless a real breakdown is imported. */
  ratingBreakdown?: Record<string, number>;
  /** Share of reviewers who would recommend, 0–100. */
  recommendPercent?: number;
  /** Aggregated themes, e.g. { label: 'Battery Life', count: 32 }. */
  reviewTopics?: Array<{ label: string; count: number }>;
  reviewSummary?: string;
  reviewSummaryIsAi?: boolean;
  customerImages?: string[];
  reviews?: ProductReview[];
  /** Set by toListingCard (which strips `reviews`): average rating of the reviews the page shows, and their count. */
  shownReviewRating?: number | null;
  shownReviewCount?: number;
  reviewsUrl?: string;
  /** Genuine aggregate from the review catalogue; preferred over `rating`. */
  ratingReal?: number;
  reviewCountReal?: number;
  ratingOriginal?: number;
  reviewCountOriginal?: number;
}

/*
 * Buy buttons only for absolute http(s) retailer URLs. About 45 imported offers
 * carry Google Shopping tokens as relative `/goto?url=CAES...` paths; the site
 * has no /goto route, so each rendered a buy button (and an Offer in the
 * product schema) that 404s (SEO audit, Oct 2026, H1/C2). Dropped here, before
 * any component or schema sees them, until the offers are re-imported with real
 * retailer URLs.
 */
function isLiveRetailerUrl(url: unknown): boolean {
  if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) return false;
  try {
    return Boolean(new URL(url).hostname);
  } catch {
    return false;
  }
}

function liveRetailers<T extends { url: string }>(retailers: T[] | undefined): T[] {
  return (retailers ?? []).filter((r) => isLiveRetailerUrl(r?.url));
}

export async function getAllProducts(): Promise<Product[]> {
 return (await catalogue()).filter(p=>p.editorial?.enabled).map(p=>({
  slug:p.slug,name:p.editorial.name||p.name,brand:p.editorial.brand||p.brand,
  ...Object.fromEntries(Object.entries(p.editorial).filter(([,v])=>v!==null)),match:p.editorial.match??[],
  retailers:liveRetailers<RetailerLink>(p.editorial.retailers??p.retailers),
 })).sort((a,b)=>a.slug.localeCompare(b.slug));
}

/**
 * One catalogue entry, in the shape an article's ProductBox expects.
 *
 * The catalogue carries a photograph and a `bestFor` line, which is what the box
 * needs; it carries no pros or cons, because those are editorial claims and
 * nobody has written them. The box renders without them.
 *
 * `rating` is deliberately dropped. A star rating in an article reads as "we
 * tested this", and CLAUDE.md is explicit that an unearned rating implies
 * testing that did not happen. The /products/ pages present catalogue ratings in
 * their own context; an inline buy box is not that context.
 */
function fromCatalogue(p: TopProduct): Product {
  return {
    slug: p.slug,
    name: p.name,
    brand: p.brand,
    match: [p.name],
    bestFor: p.bestFor,
    image: p.image,
    retailers: p.retailers,
    categoryKey: p.categoryKey,
    categorySlug: p.categorySlug,
    categoryName: p.categoryName,
    priceAud: p.priceAud,
  };
}

/**
 * Curated product files and the catalogue behind /products/.
 *
 * content/products/ holds three hand-written entries with real pros and cons.
 * The catalogue holds 200+ with photographs and retailer links. An article that
 * discusses a product on this site should be able to show it, and previously
 * only those three could be embedded — a marker for anything else silently
 * rendered nothing.
 *
 * On a slug collision the curated file supplies the editorial and the catalogue
 * record the photograph and retailers (see below).
 */
export async function getProductBySlug(slug: string): Promise<Product | undefined> {
  const curated = (await getAllProducts()).find((p) => p.slug === slug);
  // An empty listing is not embedded: the box would link to a page with
  // nothing on it (isEmptyListing).
  const listed = (await getListableTopProducts()).find((p) => p.slug === slug || p.id === slug);

  /*
   * A curated file for a catalogue product supplies the editorial (bestFor,
   * pros, cons, note, match) on top of the catalogue record, which keeps the
   * real photograph and the verified retailer prices. Replacing the record
   * wholesale, as a curated-only product does, would swap those for the
   * file's placeholder search links.
   */
  if (curated && listed) {
    const base = fromCatalogue(listed);
    return {
      ...base,
      bestFor: curated.bestFor || base.bestFor,
      pros: curated.pros,
      cons: curated.cons,
      note: curated.note,
      identifiers: curated.identifiers,
      match: Array.from(new Set([...curated.match, ...base.match])),
    };
  }
  if (curated) return curated;
  return listed ? fromCatalogue(listed) : undefined;
}

/** The curated file for a slug, if there is one (content/products/<slug>.md). */
export async function getCuratedProduct(slug: string): Promise<Product | undefined> {
  return (await getAllProducts()).find((p) => p.slug === slug);
}

export async function getProductsBySlugs(slugs: string[]): Promise<Product[]> {
  return (await Promise.all(slugs.map((s) => getProductBySlug(s))))
    .filter((p): p is Product => p !== undefined);
}

export async function getAllTopProducts(): Promise<TopProduct[]> {
 const keepSeeded=process.env.PRODUCTS_KEEP_SEEDED_RATINGS==='1';
 return (await catalogue()).filter(p=>p.catalogueListing!==false).map(raw=>{
  const product={...raw,retailers:liveRetailers(raw.retailers)};
  return !keepSeeded&&typeof product.ratingReal==='number'
   ? {...product,rating:product.ratingReal,reviewCount:product.reviewCountReal??product.reviewCount}
   : product;
 }) as TopProduct[];
}

export async function getTopProductsByCategory(categorySlugOrKey: string): Promise<TopProduct[]> {
  const all = await getAllTopProducts();
  return all.filter(
    (p) => p.categorySlug === categorySlugOrKey || p.categoryKey === categorySlugOrKey,
  );
}

export async function getTopProductBySlug(slug: string): Promise<TopProduct | undefined> {
  const all = await getAllTopProducts();
  return all.find((p) => p.slug === slug);
}

/*
 * Which product pages carry enough of our own writing to be worth indexing.
 *
 * A /products/<slug>/ page is otherwise a price listing: catalogue specs,
 * retailer prices and syndicated reviews, the same as every other price
 * comparison site. Indexed at scale, that reads to Google and an AdSense
 * reviewer as thin affiliate content (CLAUDE.md rule 3).
 *
 * The rule (AdSense Task 2, 24 Sep 2026). A page is indexable only with ALL of:
 *   - a curated file in content/products/<slug>.md,
 *   - a bestFor line, at least 3 pros and at least 2 cons,
 *   - INDEXABLE_MIN_WORDS words of original editorial text (originalWordCount).
 * Everything else is noindex, follow, out of the sitemap, and labelled as a
 * price listing on the page. Under EMPTY_BELOW_WORDS it is also kept out of
 * every listing (isEmptyListing), so no internal link points at an empty page;
 * its URL still resolves.
 *
 * scripts/audit-thin-content.mjs replicates this rule (it cannot import
 * TypeScript); change both together.
 */
export const INDEXABLE_MIN_WORDS = 300;
export const EMPTY_BELOW_WORDS = 50;

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

const stripHtml = (html?: string) =>
  String(html ?? '').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ');

/**
 * Words of our own editorial text on a product page: the curated file's body
 * (HTML comments excluded), bestFor, pros and cons, and the shortDescription
 * blurb. The long description counts only when it is our rewrite
 * (descriptionRewrite.model set): otherwise that field holds the old generated
 * template, which is not original writing. Never counted: the scraped
 * manufacturer description, specifications, retailer data or reviews.
 */
export function originalWordCount(product: TopProduct): number {
  const curated = product.editorial?.enabled ? product.editorial : undefined;
  const note = (curated?.note ?? '').replace(/<!--[\s\S]*?-->/g, ' ');
  const bestFor = curated?.bestFor || product.bestFor || '';
  const pros = curated?.pros ?? product.pros ?? [];
  const cons = curated?.cons ?? product.cons ?? [];
  const rewritten = (product as TopProduct & { descriptionRewrite?: { model?: string } }).descriptionRewrite?.model
    ? stripHtml(product.cmsDescriptionHtml)
    : '';
  return countWords([note, bestFor, ...pros, ...cons, product.shortDescription ?? '', rewritten].join(' '));
}

/** The indexing rule above. */
export function isIndexableProduct(product: TopProduct): boolean {
  const curated = product.editorial?.enabled ? product.editorial : undefined;
  if (!curated) return false;
  if (!(curated.bestFor || product.bestFor)) return false;
  if ((curated.pros ?? product.pros ?? []).length < 3) return false;
  if ((curated.cons ?? product.cons ?? []).length < 2) return false;
  return originalWordCount(product) >= INDEXABLE_MIN_WORDS;
}

/** Under EMPTY_BELOW_WORDS of our own text: kept out of every listing. */
export function isEmptyListing(product: TopProduct): boolean {
  return originalWordCount(product) < EMPTY_BELOW_WORDS;
}

/** Catalogue products whose pages are indexable. */
export async function getIndexableTopProducts(): Promise<TopProduct[]> {
  return (await getAllTopProducts()).filter(isIndexableProduct);
}

/** Catalogue products that may be listed or linked (not empty listings). */
export async function getListableTopProducts(): Promise<TopProduct[]> {
  return (await getAllTopProducts()).filter((p) => !isEmptyListing(p));
}

/**
 * A real offer: a price on the product or on at least one retailer. Without
 * one, every buy link is a retailer search URL, so the card has nothing to
 * send a reader to.
 */
export function hasOffer(product: TopProduct): boolean {
  return typeof product.priceAud === 'number' || product.retailers.some((r) => typeof r.priceAud === 'number');
}

/**
 * What the product listings show: listable products with an offer. Kept apart
 * from getListableTopProducts, which also backs inline article product boxes
 * — those still render for a product without a price.
 */
export async function getShoppableTopProducts(): Promise<TopProduct[]> {
  return (await getListableTopProducts()).filter(hasOffer);
}

/**
 * A catalogue product cut down to what a listing card needs.
 *
 * ProductGrid is a client component, so every field it receives is serialised
 * into the page. Passed whole, the /products/ hub shipped all ~2,000 imported
 * customer reviews (AliExpress and Shopee ones included), every spec table and
 * every description: 2.4 MB of HTML for a grid of cards.
 */
export function toListingCard(p: TopProduct): TopProduct {
  const {
    editorial: _editorial,
    reviews: _reviews,
    specifications: _specifications,
    description: _description,
    shortDescription: _shortDescription,
    cmsDescriptionHtml: _cmsDescriptionHtml,
    ...card
  } = p;
  const { rating, reviewCount } = reviewSummary(p);
  return { ...card, shownReviewRating: rating, shownReviewCount: reviewCount };
}
