import type { CatalogueItem } from '@/components/products/ProductCatalogue';
import type { TopProduct } from '@/lib/products';
import { reviewSummary } from '@/lib/review-sources';

/** A listed product cut down to what the client-side catalogue needs. */
export function toCatalogueItem(p: TopProduct, by: 'category' | 'sub'): CatalogueItem {
  const retailer = p.retailers?.find((r) => r.primary) ?? p.retailers?.[0];
  const summary = reviewSummary(p);
  return {
    slug: p.slug,
    name: p.name,
    brand: p.brand,
    image: p.image,
    group: by === 'category' ? p.categorySlug : (p.subCategory ?? 'Other'),
    groupLabel: by === 'category' ? p.categoryName : (p.subCategory ?? p.categoryName),
    retailerName: retailer?.name,
    retailerUrl: retailer?.url,
    rating: summary.rating,
    reviewCount: summary.reviewCount,
  };
}
