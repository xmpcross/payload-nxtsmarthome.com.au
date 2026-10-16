import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import ArchiveHeader from '@/components/ArchiveHeader';
import Card11 from '@/components/PostCards/Card11';
import { toTPost } from '@/data/posts';
import JsonLd from '@/components/JsonLd';
import { getAllArticles } from '@/lib/content';
import { AUTHOR_ALIASES, getAllAuthors, getAuthorBySlug, resolveAuthor } from '@/lib/authors';
import { breadcrumbJsonLd, metaDescription } from '@/lib/seo';
import { site } from '@/lib/site';

// Listings refresh from Strapi every 5 minutes (ISR), like the article pages.
export const revalidate = 300;

export async function generateStaticParams() {
  return getAllAuthors().map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const author = getAuthorBySlug(slug);
  if (!author) return {};
  // An author page with nothing published under it is an empty page: out of
  // the index (and the sitemap) until there is something to list.
  const count = (await getAllArticles()).filter((a) => resolveAuthor(a.author).slug === author.slug).length;
  return {
    title: `${author.name} — Articles`,
    description: metaDescription(author.bio),
    alternates: { canonical: `/authors/${author.slug}/` },
    ...(count ? {} : { robots: { index: false, follow: true } }),
  };
}

export default async function AuthorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // Merged profile (lib/authors.ts AUTHOR_ALIASES); nginx 301s it first.
  if (AUTHOR_ALIASES[slug]) permanentRedirect(`/authors/${AUTHOR_ALIASES[slug]}/`);
  const author = getAuthorBySlug(slug);
  if (!author) notFound();

  // Articles this author is credited on. resolveAuthor() rather than a raw
  // string compare, so the editorial page also collects everything that names
  // nobody — which is the majority, and the honest place for it to land.
  const articles = (await getAllArticles()).filter(
    (a) => resolveAuthor(a.author).slug === author.slug,
  );

  return (
    <div className="page-author">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: author.name, path: `/authors/${author.slug}/` },
        ])}
      />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': author.slug === 'nxt-smart-home-editorial' ? 'Organization' : 'Person',
          name: author.name,
          url: `${site.url}/authors/${author.slug}/`,
          ...(author.bio ? { description: author.bio } : {}),
          ...(author.role ? { jobTitle: author.role } : {}),
        }}
      />

      <ArchiveHeader
        eyebrow={author.role}
        title={author.name}
        intro={
          <>
            {author.bio && <p>{author.bio}</p>}
            {author.links?.length ? (
              <p className="mt-2 flex flex-wrap gap-4">
                {author.links.map((l) => (
                  <a key={l.href} href={l.href} className="font-medium text-primary-600 hover:underline dark:text-primary-400">
                    {l.label} →
                  </a>
                ))}
              </p>
            ) : null}
          </>
        }
        meta={`${articles.length} ${articles.length === 1 ? 'article' : 'articles'}`}
        image={author.avatar || undefined}
        initials={author.initials}
        round
      />

      <div className="container pt-10 pb-24 lg:pt-16 lg:pb-28">
        {author.note ? (
          <p className="mb-10 max-w-3xl leading-relaxed text-neutral-600 dark:text-neutral-300">{author.note}</p>
        ) : null}

        {articles.length ? (
          <div className="grid gap-[15px] sm:grid-cols-2 lg:grid-cols-3">
            {articles.map((article) => (
              <Card11 key={article.slug} post={toTPost(article)} />
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-neutral-300 p-8 text-center text-neutral-500 dark:border-neutral-700">
            Nothing published under this byline yet.
          </p>
        )}
      </div>
    </div>
  );
}
