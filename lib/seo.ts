import { site } from './site';
import { DEFAULT_AUTHOR_SLUG, resolveAuthor } from './authors';
import type { Article } from './content';
import type { TopProduct } from './products';
import { articleHref } from './urls';

const abs = (pathname: string) => new URL(pathname, site.url).toString();

/** Organisation + site-level JSON-LD. Rendered once in the root layout. */
export function organisationJsonLd() {
  const sameAs = Object.values(site.social).filter(Boolean);
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': ORGANISATION_ID,
        name: site.organisation.name,
        url: site.url,
        email: site.organisation.email,
        // Entity signals the audit found missing (GEO-3 / #24).
        logo: { '@type': 'ImageObject', url: `${site.url}/icon-512.png`, width: 512, height: 512 },
        description: site.metaDescription,
        areaServed: { '@type': 'Country', name: 'Australia' },
        ...(sameAs.length ? { sameAs } : {}),
      },
      {
        '@type': 'WebSite',
        '@id': WEBSITE_ID,
        url: site.url,
        name: site.name,
        description: site.description,
        inLanguage: site.language,
        publisher: { '@id': `${site.url}/#organisation` },
        /*
          No SearchAction: it advertised /search/, which robots.txt disallows
          (and which is noindex), and Google retired the sitelinks search box
          in Nov 2024, so it had no benefit to offset the contradiction.
        */
      },
    ],
  };
}

/** @id of the site-wide WebSite node, for isPartOf references. */
export const WEBSITE_ID = `${site.url}/#website`;
/** @id of the site-wide Organization node. */
export const ORGANISATION_ID = `${site.url}/#organisation`;

/**
 * @id for an author entity, shared by the Article byline and the author page so
 * both describe one node. The editorial team is an Organization, everyone
 * else a Person.
 */
export function authorEntityId(slug: string): string {
  return `${site.url}/authors/${slug}/#${slug === DEFAULT_AUTHOR_SLUG ? 'organisation' : 'person'}`;
}

/**
 * Brand suffix the root layout's title template appends (" | NXT Smart Home").
 * Kept in step with app/(frontend)/layout.tsx.
 */
const TITLE_SUFFIX_LENGTH = ` | ${site.name}`.length;
const TITLE_MAX = 60;
const escapeRe = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const BRAND_TAIL = new RegExp(`\\s*[|·•—–-]\\s*${escapeRe(site.name)}(?:\\s+AU)?\\s*$`, 'i');

/**
 * A page <title> with the brand exactly once, or not at all when it would not fit.
 *
 * - A trailing " | NXT Smart Home" (or " — NXT Smart Home AU") already in the
 *   source text — common in CMS seoTitle fields — is stripped, so the template
 *   cannot double it.
 * - A title that still names the brand ("Contact NXT Smart Home") is returned
 *   as an absolute title, so the template does not add it again.
 * - A title that would pass ~60 characters with the suffix is returned
 *   absolute, without the brand: the meaningful part is what survives
 *   truncation in a results page.
 * - Otherwise the plain string, and the root template adds " | NXT Smart Home".
 *
 * The CMS text itself is never rewritten beyond removing the duplicate brand.
 */
export function pageTitle(text: string): string | { absolute: string } {
  let title = text.replace(/\s+/g, ' ').trim();
  while (BRAND_TAIL.test(title)) title = title.replace(BRAND_TAIL, '').trim();
  if (!title) return { absolute: site.name };
  if (title.toLowerCase().includes(site.name.toLowerCase())) return { absolute: title };
  if (title.length + TITLE_SUFFIX_LENGTH > TITLE_MAX) return { absolute: title };
  return title;
}

/** The text of a pageTitle() result, for og:title / twitter:title. */
export function titleText(title: string | { absolute: string }): string {
  return typeof title === 'string' ? title : title.absolute;
}

/**
 * `alternates` for a page: its canonical plus the RSS feed. A page's
 * `alternates` replaces the root layout's wholesale, so without repeating the
 * feed here the <link rel="alternate" type="application/rss+xml"> only
 * appeared on pages that set no canonical at all.
 */
export function pageAlternates(canonical: string) {
  return {
    canonical,
    types: { 'application/rss+xml': [{ url: '/feed.xml', title: `${site.name} — latest guides` }] },
  };
}

export interface Crumb {
  name: string;
  path: string;
}

export function breadcrumbJsonLd(crumbs: Crumb[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: abs(crumb.path),
    })),
  };
}

export function articleJsonLd(article: Article) {
  const url = abs(articleHref(article));
  /*
    Always an Article. A Review with a reviewRating asserts a hands-on verdict,
    and nothing here records that a device was genuinely tested, so a `review`
    type alone must not produce one (CLAUDE.md rule 5, /how-we-test/).
  */
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    '@id': `${url}#article`,
    headline: article.title,
    name: article.title,
    description: article.description,
    url,
    inLanguage: site.language,
    datePublished: article.date,
    dateModified: article.updated ?? article.date,
    /*
      The byline as structured data. A named contributor is a Person with their
      own profile URL; the editorial team is an Organization. Typing an editorial
      byline as a Person would assert that an individual wrote it.
    */
    author: (() => {
      const a = resolveAuthor(article.author);
      const isTeam = a.slug === DEFAULT_AUTHOR_SLUG;
      return {
        '@type': isTeam ? 'Organization' : 'Person',
        // Same @id as the entity on the author's own page, so the byline and
        // the profile resolve to one node.
        '@id': authorEntityId(a.slug),
        name: a.name,
        url: `${site.url}/authors/${a.slug}/`,
      };
    })(),
    publisher: { '@id': `${site.url}/#organisation` },
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    ...(article.image ? { image: abs(article.image) } : {}),
    ...(article.tags?.length ? { keywords: article.tags.join(', ') } : {}),
  };
}

export function faqJsonLd(faq: { q: string; a: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  };
}

/** Roundups and buying guides get an ItemList so Google can show the ranked set. */
export function itemListJsonLd(article: Article) {
  if (!article.products?.length) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: article.title,
    itemListElement: article.products.map((product, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'Product',
        name: product.name,
        ...(product.brand ? { brand: { '@type': 'Brand', name: product.brand } } : {}),
        ...(product.image ? { image: abs(product.image) } : {}),
      },
    })),
  };
}

/**
 * Page-level schema for the CMS information pages (about, contact, how-we-test,
 * affiliate disclosure, privacy, cookies, terms): AboutPage / ContactPage /
 * WebPage, tied to the site and organisation by @id, with its breadcrumb.
 * Nothing here asserts anything the page does not show.
 */
export function infoPageJsonLd({ slug, name, description }: { slug: string; name: string; description?: string }) {
  const url = abs(`/${slug}/`);
  const type = slug === 'about' ? 'AboutPage' : slug === 'contact' ? 'ContactPage' : 'WebPage';
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': type,
        '@id': `${url}#webpage`,
        url,
        name,
        ...(description ? { description } : {}),
        inLanguage: site.language,
        isPartOf: { '@id': WEBSITE_ID },
        ...(type === 'WebPage' ? {} : { about: { '@id': ORGANISATION_ID } }),
        breadcrumb: { '@id': `${url}#breadcrumb` },
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${url}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: abs('/') },
          { '@type': 'ListItem', position: 2, name, item: url },
        ],
      },
    ],
  };
}

/** Serialise for a <script type="application/ld+json"> tag, escaping the XSS vector. */
export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

export { abs };

/**
 * Trim text for a meta description at a sentence or word boundary. A hard
 * `slice(0, 160)` cut category and author descriptions mid-word ("…alarm sy").
 * Prefers the last full sentence that fits; otherwise the last whole word plus
 * an ellipsis.
 */
export function metaDescription(text: string | undefined, max = 155): string | undefined {
  if (!text) return text;
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max + 1);
  const sentenceEnd = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('? '), cut.lastIndexOf('! '));
  if (sentenceEnd >= 80) return cut.slice(0, sentenceEnd + 1);
  const space = cut.lastIndexOf(' ', max - 1);
  return `${cut.slice(0, space > 0 ? space : max - 1).replace(/[\s,;:–—-]+$/, '')}…`;
}

/**
 * Product structured data.
 *
 * Product pages carried only the Organization graph, so 199 pages with verified
 * retailer pricing were invisible to Google's product results — nothing in
 * Search Console's Merchant listings or Product snippets reports.
 *
 * Everything here is measured. Prices come from the verified retailer offers,
 * not the seeded `priceAud`, which the catalogue's own notes describe as never
 * having been a real RRP.
 *
 * No aggregateRating and no Review, even where the page shows a retailer review
 * aggregate. Those reviews are syndicated from other sites, and Google's review
 * snippet policy requires ratings to come from the site's own users — marking
 * them up risks a structured-data manual action. The visible, labelled reviews
 * block (lib/review-sources.ts) is unaffected.
 */
export function productJsonLd(product: TopProduct) {
  // Offers only for a priced, verified product page (deepLink), never a
  // retailer search page; and no availability, which we do not know (audit #6).
  const priced = (product.retailers ?? []).filter(
    (r) => typeof r.priceAud === 'number' && r.priceAud > 0 && r.deepLink === true && !/[?&](?:q|k|query)=|\/search\b/i.test(r.url),
  );
  const prices = priced.map((r) => r.priceAud as number).sort((a, b) => a - b);

  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    url: `${site.url}/products/${product.slug}/`,
    ...(product.image ? { image: abs(product.image) } : {}),
    ...(product.shortDescription || product.description
      ? { description: (product.shortDescription || product.description || '').slice(0, 5000) }
      : {}),
    ...(product.brand ? { brand: { '@type': 'Brand', name: product.brand } } : {}),
    ...(product.categoryName ? { category: product.categoryName } : {}),
  };

  if (prices.length) {
    data.offers = {
      '@type': 'AggregateOffer',
      priceCurrency: 'AUD',
      lowPrice: prices[0],
      highPrice: prices[prices.length - 1],
      offerCount: prices.length,
      offers: priced.map((r) => ({
        '@type': 'Offer',
        priceCurrency: 'AUD',
        price: r.priceAud,
        url: r.url,
        seller: { '@type': 'Organization', name: r.name },
      })),
    };
  }

  return data;
}
