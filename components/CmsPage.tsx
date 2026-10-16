import { notFound } from 'next/navigation'
import sanitizeHtml from 'sanitize-html'
import { getPage } from '@/lib/site-content'
import ContactForm from './ContactForm'
import ContactPage from './ContactPage'
// Contact body classes are dropped: ContactPage styles the lifted header/aside itself.
const TAGS=[...sanitizeHtml.defaults.allowedTags,'img','section','main','nav','header','aside','figure','figcaption','div','span']
const unstyled=(h:string)=>sanitizeHtml(h,{allowedTags:TAGS,allowedAttributes:{'*':['id','aria-*'],a:['href','target','rel','title']}})
export async function pageMetadata(slug:string){const p=await getPage(slug);return p?{title:p.seoTitle||p.title,description:p.seoDescription||undefined,alternates:{canonical:`/${slug}/`}}:{}}
export default async function CmsPage({slug}:{slug:string}){
 const page=await getPage(slug);if(!page)notFound()
 let html=sanitizeHtml(page.bodyHtml,{allowedTags:TAGS,allowedAttributes:{'*':['class','id','role','aria-*'],a:['href','target','rel','title'],img:['src','srcset','sizes','alt','width','height','loading','decoding']},allowedSchemes:['http','https','mailto','tel'],allowProtocolRelative:false})
 const title=sanitizeHtml(page.title,{allowedTags:[],allowedAttributes:{}})
 html=/<h1\b/i.test(html)?html.replace(/(<h1\b[^>]*>)[\s\S]*?<\/h1>/i,(_,start)=>`${start}${title}</h1>`):`<h1>${title}</h1>${html}`
 if(slug==='contact'){const hero=html.match(/<header\b[^>]*>([\s\S]*?)<\/header>/i)?.[1];const notes=html.match(/<aside\b[^>]*>([\s\S]*?)<\/aside>/i)?.[1];if(hero&&notes)return <ContactPage hero={unstyled(hero.replace(/<nav\b[\s\S]*?<\/nav>/i,''))} notes={unstyled(notes)}/>}
 return <><div dangerouslySetInnerHTML={{__html:html}}/>{slug==='contact'&&<div className="container pb-20"><div className="max-w-3xl"><ContactForm/></div></div>}</>
}
