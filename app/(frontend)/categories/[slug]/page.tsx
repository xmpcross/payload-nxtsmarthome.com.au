import type { Metadata } from 'next';
import { metaDescription } from '@/lib/seo';
import { notFound } from 'next/navigation';
import CategoryView from '@/components/CategoryView';
import { getAllArticles, getArticlesByCategory } from '@/lib/content';
import { categories, getCategory, isGuideCategory } from '@/lib/site';

// Listings refresh from Strapi every 5 minutes (ISR), like the article pages.
export const revalidate = 300;

export async function generateStaticParams() {
  return categories.map((category) => ({ slug: category.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const category = getCategory(slug);
  if (!category) return {};
  const articles = await getArticlesByCategory(category.key);

  return {
    // Not "Reviews": the guides are research-based and the site publishes no
    // reviews (/how-we-test/, PRODUCT.md).
    title: isGuideCategory(category.slug)
      ? `Smart Home ${category.name} for Australian Homes`
      : `${category.name} — Australian Guides & Buying Advice`,
    description: metaDescription(category.intro),
    alternates: { canonical: `/categories/${category.slug}/` },
    // A category with nothing published is a thin page: keep it out of the
    // index until its first article lands (it leaves the sitemap too).
    ...(articles.length === 0 ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const category = getCategory(slug);
  if (!category) notFound();

  const articles = await getArticlesByCategory(category.key);
  const all = await getAllArticles();

  return (
    <CategoryView
      category={category}
      articles={articles}
      allArticles={all}
    />
  );
}
