import { getSettings } from '@/lib/site-content'
import { getCategoriesWithPosts } from '@/data/categories'
import { getAllArticles } from '@/lib/content'
import { site } from '@/lib/site'
import type { Metadata } from 'next'
import JsonLd from '@/components/JsonLd'
import HomeLanding, { type HomeProduct } from '@/components/home/HomeLanding'
import { getShoppableTopProducts, isIndexableProduct } from '@/lib/products'
import { resolveAuthor } from '@/lib/authors'
import { AFFILIATE_ENABLED } from '@/lib/affiliate'
import { ADS_ENABLED } from '@/lib/ads'
import { metaDescription, pageAlternates, pageTitle, titleText, WEBSITE_ID } from '@/lib/seo'

export const revalidate = 300

const HOME_TITLE = 'Smart Home Guides for Australian Homes'
const HOME_DESCRIPTION =
  'Independent smart home buying guides, setup help and explainers for Australian homes: lighting, security cameras, energy, climate, robot vacuums and hubs, with Australian retailers and 230V wiring in mind.'

export async function generateMetadata(): Promise<Metadata> {
 const settings=await getSettings()
 // Brand once (a CMS homeTitle that already ends in the brand is not doubled);
 // description capped at ~155 chars on a word boundary.
 const title=titleText(pageTitle(settings.homeTitle||HOME_TITLE))
 const full=title.toLowerCase().includes(settings.name.toLowerCase())?title:`${title} | ${settings.name}`
 const description=metaDescription(settings.homeDescription||HOME_DESCRIPTION)
 return {title:{absolute:full},description,alternates:pageAlternates('/'),openGraph:{type:'website',url:'/',title:full,description,images:[settings.ogImage]}}
}

export default async function HomePage() {
  const articles = await getAllArticles()
  // getAllArticles is newest first: the Latest guides section shows the newest.
  const categories = await getCategoriesWithPosts()

  // Price comparison: curated (indexable) products with 3+ priced AU retailers,
  // one per category where possible.
  const shoppable = await getShoppableTopProducts()
  const priced = (p: (typeof shoppable)[number]) =>
    (p.retailers || []).filter((r) => typeof r.priceAud === 'number').sort((x, y) => (x.priceAud as number) - (y.priceAud as number))
  const eligible = shoppable.filter((p) => isIndexableProduct(p) && priced(p).length >= 3)
  const picks: typeof eligible = []
  for (const slug of ['hubs-and-platforms', 'energy-and-solar', 'robot-vacuums', 'security-and-cameras', 'lighting', 'climate-and-comfort', 'entertainment-and-audio']) {
    const p = eligible.filter((x) => x.categorySlug === slug).sort((x, y) => priced(y).length - priced(x).length)[0]
    if (p && picks.length < 6) picks.push(p)
  }
  const products: HomeProduct[] = picks.map((p) => {
    const offers = priced(p)
    return {
      slug: p.slug,
      name: p.brand && !p.name.toLowerCase().startsWith(p.brand.toLowerCase()) ? `${p.brand} ${p.name}` : p.name,
      category: p.categoryName ?? '',
      image: p.image,
      bestFor: p.bestFor,
      low: offers[0].priceAud as number,
      lowAt: offers[0].name,
      retailers: offers.length,
    }
  })
  const retailerCount = new Set(shoppable.flatMap((p) => (p.retailers || []).map((r) => r.name))).size
  const productCount = shoppable.filter(isIndexableProduct).length

  const ed = resolveAuthor(site.organisation.editor.slug)
  // Says only what is true of the site today (AFFILIATE_ENABLED / ADS_ENABLED).
  const funding = AFFILIATE_ENABLED || ADS_ENABLED
    ? `${[AFFILIATE_ENABLED && 'Some retailer links are affiliate links', ADS_ENABLED && 'the site shows advertising'].filter(Boolean).join(', and ')}. They are labelled where they appear, and never decide what we recommend.`
    : 'No brand or retailer pays for coverage. If we add affiliate links or advertising, they will be labelled where they appear and will never decide what we recommend.'

  return (
    <div className="page-home relative container">
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: HOME_TITLE,
          description: HOME_DESCRIPTION,
          url: `${site.url}/`,
          inLanguage: site.language,
          // The site-wide WebSite node by @id, not a second untyped copy; and no
          // bare Thing list, which added no entity information (schema audit #8).
          '@id': `${site.url}/#webpage`,
          isPartOf: { '@id': WEBSITE_ID },
        }}
      />

      <HomeLanding
        articles={articles}
        categories={categories}
        products={products}
        productCount={productCount}
        retailerCount={retailerCount}
        editor={{ name: ed.name, slug: ed.slug, avatar: ed.avatar, bio: ed.bio }}
        funding={funding}
      />
    </div>
  )
}
