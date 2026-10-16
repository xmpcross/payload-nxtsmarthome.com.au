import { getSettings } from '@/lib/site-content'
import SectionMagazine10 from '@/components/SectionMagazine10'
import { getCategoriesWithPosts } from '@/data/categories'
import { toTPost } from '@/data/posts'
import { getAllArticles } from '@/lib/content'
import { site } from '@/lib/site'
import type { Metadata } from 'next'
import JsonLd from '@/components/JsonLd'
import EditorsChoiceSection from '@/components/home/EditorsChoiceSection'
import ZairaBottomSections from '@/components/home/ZairaBottomSections'
import AmazonSmartHomeBanner from '@/components/home/AmazonSmartHomeBanner'
import HomeIntro from '@/components/home/HomeIntro'

export const revalidate = 300

const HOME_TITLE = 'Smart Home Guides for Australian Homes'
const HOME_DESCRIPTION =
  'Independent smart home buying guides, setup help and explainers for Australian homes: lighting, security cameras, energy, climate, robot vacuums and hubs, with Australian retailers and 230V wiring in mind.'

export async function generateMetadata(): Promise<Metadata> {
 const settings=await getSettings()
 return {title:{absolute:`${settings.homeTitle||HOME_TITLE} | ${settings.name}`},description:settings.homeDescription||HOME_DESCRIPTION,alternates:{canonical:'/'},openGraph:{type:'website',url:'/',title:`${settings.homeTitle||HOME_TITLE} | ${settings.name}`,description:settings.homeDescription||HOME_DESCRIPTION,images:[settings.ogImage]}}
}

export default async function HomePage() {
  const settings = await getSettings()
  const articles = await getAllArticles()
  // Featured first, then newest, for the lead grid.
  const lead = [...articles.filter((a) => a.featured), ...articles.filter((a) => !a.featured)].slice(0, 8)

  const categories = await getCategoriesWithPosts()
  const topics = categories.filter((c) => c.count > 0).sort((a, b) => b.count - a.count)

  const allPosts = articles.map(toTPost)

  return (
    <div className="page-home relative container space-y-[50px] pt-[30px] pb-28 lg:space-y-[50px] lg:pt-[30px] lg:pb-32">
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: HOME_TITLE,
          description: HOME_DESCRIPTION,
          url: `${site.url}/`,
          inLanguage: site.language,
          isPartOf: { '@type': 'WebSite', name: site.name, url: `${site.url}/` },
          about: topics.map((t) => ({ '@type': 'Thing', name: t.name })),
        }}
      />

      <HomeIntro title={settings.homeTitle || HOME_TITLE} />

      {/* Top Magazine Lead Grid Section */}
      <SectionMagazine10 posts={lead.map(toTPost)} />

      {/* Amazon Smart Home Interactive Banner */}
      <AmazonSmartHomeBanner />

      {/* Editors Choice Carousel Section */}
      <EditorsChoiceSection posts={allPosts} />

      {/* Zaira Theme Bottom Sections (Recent Posts, Trending News, Sidebar & Bottom Banner) */}
      <ZairaBottomSections posts={allPosts} categories={topics} />
    </div>
  )
}
