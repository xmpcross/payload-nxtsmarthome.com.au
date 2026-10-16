import { notFound, permanentRedirect } from 'next/navigation';
import { getCategory } from '@/lib/site';

/**
 * Former pages 2..N of a category listing.
 *
 * No category paginates any more: topic pages and the Buying Guides / Setup
 * Guides pillar pages show every post on one page. Old /page/N/ links (and any
 * still in search results) are sent to the category's own URL.
 */
export default async function CategoryPagedPage({
  params,
}: {
  params: Promise<{ slug: string; page: string }>;
}) {
  const { slug } = await params;
  const category = getCategory(slug);
  if (!category) notFound();
  permanentRedirect(`/categories/${category.slug}/`);
}
