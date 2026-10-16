import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import ArticleBody from '@/components/ArticleBody';
import CategoryBadgeList from '@/components/CategoryBadgeList';
import Disclosure from '@/components/Disclosure';
import Faq from '@/components/Faq';
import JsonLd from '@/components/JsonLd';
import ProductBox from '@/components/ProductBox';
import TableOfContents from '@/components/TableOfContents';
import ReadAlso from '@/components/ReadAlso';
import Comments from '@/components/Comments';
import AffiliateLinks from '@/components/AffiliateLinks';
import PostSidebar from '@/components/sidebar/PostSidebar';
import { getCategories } from '@/data/categories';
import SingleMeta from '@/components/single/SingleMeta';
import { SingleMetaAction } from '@/components/single/SingleMetaAction';
import SingleRelatedPosts from '@/components/single/SingleRelatedPosts';
import SingleTitle from '@/components/single/SingleTitle';
import { toTPost } from '@/data/posts';
import { resolveAuthor } from '@/lib/authors';
import { Badge } from '@/shared/Badge';
import { Divider } from '@/shared/divider';
import Tag from '@/shared/Tag';
import {
  coverFor,
  getAllArticles,
  getArticle,
  getRelatedWithScores,
  mergedInto,
  articleHref,
  formatDate,
  typeLabels,
} from '@/lib/content';
import { getProductsBySlugs } from '@/lib/products';
import { site } from '@/lib/site';
import { articleJsonLd, breadcrumbJsonLd, faqJsonLd, itemListJsonLd, metaDescription } from '@/lib/seo';
import { responsiveImg } from '@/lib/image'

// Articles refresh from Strapi every 5 minutes (ISR); new slugs render on demand.
export const revalidate = 300;

export async function generateStaticParams() {
  const articles = await getAllArticles();
  // Only real category slugs are emitted, so this dynamic segment can never
  // shadow a static route such as /about/ or /categories/.
  return articles.map((article) => ({
    category: article.categoryMeta?.slug ?? 'articles',
    slug: article.slug,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string; slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article) return {};

  const url = articleHref(article);
  // Search snippet: the CMS seoTitle / seoDescription when set (audit S4/S5),
  // else the H1 and the excerpt, trimmed at a sentence or word boundary.
  const title = article.seoTitle || article.title;
  const description = metaDescription(article.seoDescription || article.description) ?? '';
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      title,
      description,
      url,
      publishedTime: article.date,
      modifiedTime: article.updated ?? article.date,
      // Defining openGraph here replaces the root object entirely, so the default
      // image must be repeated — otherwise every article shares with a blank card.
      images: [article.image ?? site.ogImage],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [article.image ?? site.ogImage],
    },
  };
}

export default async function ArticlePage({ params }: { params: Promise<{ category: string; slug: string }> }) {
  const { category, slug } = await params;
  // A near-duplicate folded into another article. nginx 301s these first; this
  // covers any request that reaches the server directly.
  const survivor = mergedInto(slug);
  if (survivor) permanentRedirect(survivor);
  const article = await getArticle(slug);
  if (!article) notFound();
  // The article resolves by slug alone, so /climate/<slug>/ (a category key, as
  // generated article links often use) rendered the same page as the canonical
  // /climate-and-comfort/<slug>/. 301 to the one URL instead of serving a copy.
  const canonical = articleHref(article);
  if (canonical.split('/')[1] !== category) permanentRedirect(canonical);

  const relatedScored = await getRelatedWithScores(article, 3);
  // A wider pool so the three blocks (mid-article, Next Up, Related Posts) show
  // different articles rather than repeating the same top matches three times.
  const relatedPool = await getRelatedWithScores(article, 7);
  const readAlso = relatedPool.slice(3, 5).map((r) => r.article);
  const itemList = itemListJsonLd(article);
  const all = await getAllArticles();


  // Products placed inline by scripts/link-products.mjs. Only the ones actually
  // referenced by a marker in this article are loaded.
  const inlineSlugs = Array.from(
    new Set(Array.from(article.html.matchAll(/<p>::product:([a-z0-9-]+)::<\/p>/g), (m) => m[1])),
  );
  const inlineProducts = (await getProductsBySlugs(inlineSlugs));
  // Inline markers plus any front-matter products, deduped — the affiliate block
  // lists every retailer behind every product the article actually discusses.
  // Curated products placed inline, plus any defined inline in front matter.
  // Both carry a name and a retailer list, which is all the affiliate block needs.
  const allProducts = [...inlineProducts, ...(article.products ?? [])];

  const post = toTPost(article)
  const relatedPosts = relatedPool.map((r) => toTPost(r.article))

  // Sidebar (components/sidebar/PostSidebar.tsx), chosen as bestlooking.skin
  // chooses its own: the three newest other guides, then three more recent ones
  // with a cover as Featured Posts, other topics first. There is no featured
  // flag in the CMS, so nothing here claims an editorial pick.
  const recent = all.filter((a) => a.slug !== article.slug);
  const sidebarLatest = recent.slice(0, 3).map((a) => ({
    href: articleHref(a),
    title: a.title,
    image: responsiveImg(coverFor(a), 108, '108px'),
    imageAlt: a.imageAlt || a.title,
    date: formatDate(a.date),
    readingTime: a.readingMinutes,
  }));
  const featuredPool = recent.slice(3).filter((a) => coverFor(a));
  const inThisTopic = (a: (typeof recent)[number]) => a.categoryMeta?.slug === article.categoryMeta?.slug;
  const sidebarFeatured = [...featuredPool.filter((a) => !inThisTopic(a)), ...featuredPool.filter(inThisTopic)]
    .slice(0, 3)
    .map((a) => ({
      href: articleHref(a),
      title: a.title,
      image: responsiveImg(coverFor(a), 420, '(min-width: 1024px) 420px, 100vw'),
      imageAlt: a.imageAlt || a.title,
      author: resolveAuthor(a.author).name,
      date: formatDate(a.date),
    }));
  const sidebarTopics = (await getCategories())
    .filter((c) => c.count > 0 && c.handle !== article.categoryMeta?.slug)
    .map((c) => ({ href: `/categories/${c.handle}/`, label: c.name }));

  return (
    <>
      <JsonLd data={articleJsonLd(article)} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'Articles', path: '/articles/' },
          ...(article.categoryMeta
            ? [{ name: article.categoryMeta.name, path: `/categories/${article.categoryMeta.slug}/` }]
            : []),
          { name: article.title, path: articleHref(article) },
        ])}
      />
      {article.faq?.length ? <JsonLd data={faqJsonLd(article.faq)} /> : null}
      {itemList ? <JsonLd data={itemList} /> : null}

      <div className="single-post-page">
        {/* Header: Ncmaz single post style 1 */}
        <header className="single-header-style-1 container mt-8 lg:mt-14">
          <div className="mx-auto max-w-4xl space-y-5">
            <nav aria-label="Breadcrumb" className="text-sm text-neutral-500 dark:text-neutral-400">
              <ol className="flex flex-wrap items-center gap-2">
                <li>
                  <Link href="/" className="hover:text-neutral-900 dark:hover:text-white">
                    Home
                  </Link>
                </li>
                {article.categoryMeta && (
                  <>
                    <li aria-hidden="true">/</li>
                    <li>
                      <Link
                        href={`/categories/${article.categoryMeta.slug}/`}
                        className="hover:text-neutral-900 dark:hover:text-white"
                      >
                        {article.categoryMeta.name}
                      </Link>
                    </li>
                  </>
                )}
              </ol>
            </nav>
            <div className="flex flex-wrap items-center gap-2">
              <CategoryBadgeList categories={post.categories} />
              <Badge color="zinc">{typeLabels[article.type] ?? article.type}</Badge>
            </div>
            <SingleTitle title={article.title} />
            <p className="text-base leading-[1.7] text-neutral-600 dark:text-neutral-400">
              {article.description}
            </p>
            <Divider />
            <div className="flex flex-wrap items-center gap-5">
              <SingleMeta author={post.author} date={article.date} updated={article.updated} readingTime={post.readingTime} />
              <SingleMetaAction className="ms-auto" handle={post.handle} title={article.title} />
            </div>
          </div>

          <div className="relative mt-8 sm:mt-12">
            <img
              {...responsiveImg(coverFor(article), 1200, '(max-width: 768px) 100vw, 736px')}
              alt={article.imageAlt || article.title}
              width={1240}
              height={700}
              fetchPriority="high"
              className="aspect-16/9 w-full rounded-2xl object-cover object-center md:aspect-auto md:h-[650px]"
            />
          </div>
        </header>

        <div className="container mt-12 flex flex-col lg:flex-row">
          <article className="w-full lg:w-3/5 xl:w-2/3 xl:pe-20">
            <Disclosure />

            {article.keyTakeaway && (
              <div className="mb-8 rounded-2xl bg-primary-50 p-6 dark:bg-neutral-800">
                <p className="text-sm font-semibold tracking-wide text-primary-700 uppercase dark:text-primary-400">
                  The short answer
                </p>
                <p className="mt-2 text-base leading-[1.7] text-neutral-800 dark:text-neutral-200">{article.keyTakeaway}</p>
              </div>
            )}

            <TableOfContents headings={article.headings} />

            <div id="article-body">
              <ArticleBody
                html={article.html}
                products={inlineProducts}
                subId={article.slug}
                midSlot={<ReadAlso items={readAlso.length ? readAlso : relatedScored.slice(0, 2).map((r) => r.article)} />}
              />
            </div>

            {article.products?.length ? (
              <section className="mt-12" aria-labelledby="picks-heading">
                <h2 id="picks-heading" className="text-2xl font-semibold text-neutral-900 dark:text-white">
                  Where to buy
                </h2>
                <Disclosure compact />
                {article.products.map((product, index) => (
                  <ProductBox
                    key={product.name}
                    product={product}
                    subId={article.slug}
                    rank={article.products!.length > 1 ? index + 1 : undefined}
                  />
                ))}
              </section>
            ) : null}

            {article.tags?.length ? (
              <div className="mt-10 flex flex-wrap gap-2">
                {article.tags.map((tag) => (
                  <Tag key={tag} href={`/search/?q=${encodeURIComponent(tag)}`}>
                    {tag}
                  </Tag>
                ))}
              </div>
            ) : null}

            {article.faq?.length ? <Faq items={article.faq} /> : null}

            {/* Affiliate Link notice (products present only), above the comments. */}
            <AffiliateLinks products={allProducts} subId={article.slug} />

            <div id="comments" className="scroll-mt-24">
              <Comments slug={article.slug} />
            </div>
          </article>

          <PostSidebar latest={sidebarLatest} topics={sidebarTopics} featured={sidebarFeatured} />
        </div>

        <SingleRelatedPosts relatedPosts={relatedPosts} />
      </div>
    </>
  );
}
