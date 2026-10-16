import { AFFILIATE_ENABLED, affiliateUrl } from '@/lib/affiliate';
import type { RetailerLink } from '@/lib/content';

/**
 * Both sources of products share this shape: curated files in content/products
 * (lib/products.Product) and inline ProductRef entries in an article's front
 * matter. Typing the union structurally lets one block cover both.
 */
interface Stocked {
  name: string;
  retailers?: RetailerLink[];
}

/**
 * "Affiliate Link" notice above the comments. It used to list every retailer the article's products are stocked at,
 * listed in full at the foot of the post.
 *
 * The inline buy boxes only surface the primary retailers. This block scans the
 * same product data for the rest of the source retailers, so a reader who wants
 * to price-check elsewhere can, and so no configured link goes unattributed.
 *
 * Every link is decorated through affiliateUrl() with the article slug as the
 * subID, exactly as the buy boxes are, and carries rel="sponsored nofollow".
 *
 * It renders nothing when an article references no products. Listing retailers
 * for products the article does not actually discuss would be inventing
 * commercial relationships that do not exist.
 */
export default function AffiliateLinks({
  products,
  subId,
}: {
  products: Stocked[];
  subId: string;
}) {
  // One entry per unique destination, so a retailer stocking two of the products
  // appears once per product rather than once overall.
  const seen = new Set<string>();
  const links: { label: string; url: string }[] = [];

  for (const product of products) {
    for (const retailer of product.retailers ?? []) {
      if (!retailer?.url || seen.has(retailer.url)) continue;
      seen.add(retailer.url);
      links.push({
        label: `${product.name} at ${retailer.name}`,
        url: affiliateUrl(retailer.url, { subId }),
      });
    }
  }

  // No affiliate tracking running (lib/affiliate.ts): nothing to disclose.
  if (!links.length || !AFFILIATE_ENABLED) return null;

  // Heading and disclosure only: the product links themselves were removed from
  // this block (24 Sep 2026). The article's buy boxes carry the links; this
  // stays as the affiliate notice above the comments, shown only when the
  // article has products.
  return (
    <section className="not-prose mt-12" aria-labelledby="affiliate-link-heading">
      <p
        id="affiliate-link-heading"
        className="text-base font-bold text-slate-900 dark:text-white"
      >
        Affiliate Link
      </p>

      <p className="mt-2 text-[14px] leading-[22px] text-slate-600 dark:text-slate-300">
        Some of the links in this article are affiliate links. If you buy through one we may
        earn a commission, at no extra cost to you. It never changes what we
        recommend — see our{' '}
        <a
          href="/affiliate-disclosure/"
          className="font-medium text-brand-700 underline underline-offset-2 hover:text-brand-800 dark:text-brand-400"
        >
          affiliate disclosure
        </a>
        .
      </p>
    </section>
  );
}
