import { articleHref, getAllArticles } from '@/lib/content'
import { site } from '@/lib/site'

// RSS 2.0 feed of the newest articles, linked from the footer. Refreshes with
// the articles (ISR, 5 minutes), like the listings.
export const revalidate = 300

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export async function GET() {
  const articles = (await getAllArticles())
    .slice()
    .sort((a, b) => +new Date(b.date) - +new Date(a.date))
    .slice(0, 30)

  const items = articles
    .map((a) => {
      const url = `${site.url}${articleHref(a)}`
      return `    <item>
      <title>${esc(a.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${new Date(a.updated ?? a.date).toUTCString()}</pubDate>
      <description>${esc(a.description)}</description>
    </item>`
    })
    .join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc(site.name)}</title>
    <link>${site.url}/</link>
    <description>${esc(site.metaDescription)}</description>
    <language>en-AU</language>
    <atom:link href="${site.url}/feed.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`
  return new Response(xml, {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' },
  })
}
