/**
 * Which syndicated customer reviews a product page may show, and the one
 * aggregate score it may show with them. The single allow-list for the site
 * (AdSense Task 3, 24 Sep 2026).
 *
 * The imported reviews come from Google Shopping's review catalogue, which
 * pools every storefront worldwide: AliExpress, Shopee, Lazada, Kaufland, US,
 * Canadian and UK chains, brand stores, unknown shops. On an Australian site a
 * review from shopee.com.my says nothing a reader here can check, so a review
 * renders only when its source is:
 *   - a named Australian retailer (AU_REVIEW_RETAILERS), or
 *   - the product brand's own Australian site (<brand>*.com.au), or
 *   - the product brand's own global store (ring.com, sonos.com, eufylife.com),
 *     always labelled "<Brand> (global store)" so it is not mistaken for an
 *     Australian retailer.
 *
 * Thresholds:
 *   - under MIN_VISIBLE_REVIEWS allowed reviews, the reviews block is hidden;
 *   - the aggregate score and histogram are counted from the allowed reviews
 *     only, never from the catalogue's pooled Google Shopping rating, and
 *     under MIN_AGGREGATE_REVIEWS they are not shown (nor emitted as
 *     AggregateRating structured data).
 *
 *
 * CHANGED 17 Oct 2026 (user request): a product with any review now shows its reviews block, whatever
 * the source. Reviews from sources that are not Australian retailers or the brand's own store are
 * still labelled with where they were posted (the domain), flagged `overseas`, and listed after the
 * Australian ones. The aggregate score still needs MIN_AGGREGATE_REVIEWS reviews, and none of this
 * reaches structured data (lib/seo.ts emits no aggregateRating and no Review).
 *
 * CHANGED 18 Oct 2026 (content audit C4): overseas reviews are still shown, but the score, the
 * histogram, the "4 stars or higher" share and the stars on product cards count only Australian
 * sources (`counted`): the named Australian retailers and the brand's Australian site. An overseas
 * review, or one from the brand's global store, often describes another variant, plug or warranty,
 * so it should not move the number an Australian reader sees.
 *
 * No fs here: ProductReviews is a client component and imports this.
 */
import type { ProductReview, TopProduct } from './products';

export const MIN_VISIBLE_REVIEWS = 1;
export const MIN_AGGREGATE_REVIEWS = 20;

/** Review source (a domain, as the catalogue labels it) -> Australian retailer name. */
const AU_REVIEW_RETAILERS: Record<string, string> = {
  'jbhifi.com.au': 'JB Hi-Fi',
  'thegoodguys.com.au': 'The Good Guys',
  'harveynorman.com.au': 'Harvey Norman',
  'bunnings.com.au': 'Bunnings',
  'officeworks.com.au': 'Officeworks',
  'amazon.com.au': 'Amazon AU',
  'ebay.com.au': 'eBay AU',
  'binglee.com.au': 'Bing Lee',
  'myer.com.au': 'Myer',
  'appliancesonline.com.au': 'Appliances Online',
  'betta.com.au': 'Betta',
  'costco.com.au': 'Costco Australia',
  'mwave.com.au': 'Mwave',
  'mightyape.com.au': 'Mighty Ape',
  'kogan.com': 'Kogan',
  'kogan.com.au': 'Kogan',
  'mitre10.com.au': 'Mitre 10',
};

/*
 * Never treated as a brand store, whatever the brand: marketplaces and
 * overseas chains whose names could otherwise contain a brand token.
 */
const NOT_A_BRAND_STORE = /amazon|ebay|aliexpress|shopee|lazada|kaufland|walmart|bestbuy|homedepot|lowes|target|argos|currys|johnlewis|etsy|allegro|mediamarkt|costco|noon|influenster|galaxus|digitec/;

/** "www.JBHiFi.com.au/" -> "jbhifi.com.au"; a non-domain label is just lower-cased. */
function sourceKey(label?: string): string {
  return String(label ?? '')
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '');
}

/** "Switch-Bot" -> "switchbot"; empty when too short to match safely. */
function brandToken(brand?: string): string {
  const t = String(brand ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return t.length >= 3 ? t : '';
}

export interface ReviewSource {
  /** What the review card says it is from. */
  retailer: string;
  /** A brand's global store rather than an Australian retailer. */
  global: boolean;
  /** Neither an Australian retailer nor the brand's own store: shown, labelled by its domain. */
  overseas?: boolean;
}

/** Where a review is shown as coming from. Any source is shown now; unlisted ones are labelled by domain. */
export function reviewSource(review: ProductReview, brand?: string): ReviewSource {
  const key = sourceKey(review.sourceLabel);
  const other: ReviewSource = { retailer: key || 'another retailer', global: true, overseas: true };
  if (!key) return other;
  const au = AU_REVIEW_RETAILERS[key];
  if (au) return { retailer: au, global: false };

  const token = brandToken(brand);
  if (!token || NOT_A_BRAND_STORE.test(key)) return other;
  // The part of the domain that names the site: "eufylife" in eufylife.com,
  // "google" in store.google.com, "switchbot" in switch-bot.com.
  const labels = key.replace(/\.(com|net|co|org)?\.?(au|uk|nz|ca)?$/, '').split('.');
  const name = (labels[labels.length - 1] ?? '').replace(/[^a-z0-9]/g, '');
  if (!name.includes(token)) return other;

  const brandName = String(brand).trim();
  return key.endsWith('.com.au')
    ? { retailer: `${brandName} Australia`, global: false }
    : { retailer: `${brandName} (global store)`, global: true };
}

export interface RetailerReviews {
  /** Empty when fewer than MIN_VISIBLE_REVIEWS are allowed: the block is hidden. */
  reviews: (ProductReview & { retailer: string; overseas: boolean; australian: boolean })[];
  /** The rated reviews the score and histogram count: Australian retailers and the brand's AU site. */
  counted: (ProductReview & { retailer: string; overseas: boolean; australian: boolean })[];
  /** Distinct sources, most reviews first. */
  retailers: string[];
  /** Counted from `counted`; null below MIN_AGGREGATE_REVIEWS. */
  aggregate: { rating: number; count: number } | null;
  /** Allowed reviews before the visibility threshold, for reporting. */
  allowedCount: number;
}

export function retailerReviews(product: Pick<TopProduct, 'reviews' | 'brand'>): RetailerReviews {
  // Australian and brand-store sources first, then the rest; the order within each group is kept.
  const allowed = (product.reviews ?? [])
    .map((r) => { const source = reviewSource(r, product.brand); return { ...r, retailer: source.retailer, overseas: Boolean(source.overseas), australian: !source.global }; })
    .sort((a, b) => Number(a.overseas) - Number(b.overseas));
  const reviews = allowed.length >= MIN_VISIBLE_REVIEWS ? allowed : [];

  const byRetailer = new Map<string, number>();
  for (const r of reviews) byRetailer.set(r.retailer, (byRetailer.get(r.retailer) ?? 0) + 1);
  const overseasNames = new Set(allowed.filter((r) => r.overseas).map((r) => r.retailer));
  const retailers = [...byRetailer.entries()].sort((a, b) => Number(overseasNames.has(a[0])) - Number(overseasNames.has(b[0])) || b[1] - a[1]).map(([name]) => name);

  const counted = reviews.filter((r) => r.australian && r.rating >= 1 && r.rating <= 5);
  const aggregate =
    counted.length >= MIN_AGGREGATE_REVIEWS
      ? { rating: counted.reduce((sum, r) => sum + r.rating, 0) / counted.length, count: counted.length }
      : null;

  return { reviews, counted, retailers, aggregate, allowedCount: allowed.length };
}

/**
 * The aggregate the reviews block shows (Australian sources only, at least
 * MIN_AGGREGATE_REVIEWS); rating null and count 0 otherwise. The cards' stars and the product page's
 * stars both come from here, so a card never claims a rating its page does not carry.
 */
export function reviewSummary(product: Pick<TopProduct, 'reviews' | 'brand'>): { rating: number | null; reviewCount: number } {
  const { aggregate } = retailerReviews(product);
  return aggregate ? { rating: aggregate.rating, reviewCount: aggregate.count } : { rating: null, reviewCount: 0 };
}

/** "JB Hi-Fi", "JB Hi-Fi and Bunnings", "JB Hi-Fi, Bunnings and Myer". */
export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}
