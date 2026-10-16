import fs from 'node:fs/promises'
import path from 'node:path'
import matter from 'gray-matter'
if(process.argv.includes('--test-db')){const u=new URL(process.env.DATABASE_URL!);u.pathname='/nxtsmarthome_admin_test';process.env.DATABASE_URL=u.toString()}
process.env.PAYLOAD_DB_PUSH='true'
const {getPayload}=await import('payload');const config=(await import('../payload.config')).default
const payload=await getPayload({config});const context={skipRevalidation:true}
const existing=await payload.count({collection:'products'});if(existing.totalDocs)throw new Error('Import requires an empty products collection; refusing duplicate import')
const source=JSON.parse(await fs.readFile('public/data/products.json','utf8'))
const curated=new Map<string,any>();for(const name of await fs.readdir('content/products')){if(!/\.mdx?$/.test(name))continue;const {data,content}=matter(await fs.readFile(path.join('content/products',name),'utf8'));if(!data.name)continue;curated.set(name.replace(/\.mdx?$/,''),{...data,note:content.trim(),enabled:true,match:[...new Set([...(data.match??[]),data.brand?`${data.brand} ${data.name}`:'',data.name].filter(Boolean))]})}
const disabledSource=JSON.parse(await fs.readFile('data/disabled-products.json','utf8').catch(()=>'{}'));const disabled=new Set((disabledSource.disabled??[]).map((x:any)=>typeof x==='string'?x:x.slug))
const all=[...source,...[...curated].filter(([slug])=>!source.some((x:any)=>x.slug===slug)).map(([slug,data])=>({...data,slug,id:slug,catalogueListing:false}))]
const merchants=new Map<string,number>();let offers=0
for(const item of all){
 const data={...item,legacyId:String(item.id),id:undefined,active:!disabled.has(item.slug),catalogueListing:item.catalogueListing!==false,editorial:curated.get(item.slug)??{enabled:false},sourceData:item}
 const product=await payload.create({collection:'products',data,context})
 for(const [order,offer] of (item.retailers??[]).entries()){
  if(!merchants.has(offer.name)){const merchant=await payload.create({collection:'merchants',data:{name:offer.name,website:/^https?:\/\//.test(offer.url)?new URL(offer.url).origin:undefined,logo:offer.logo,active:true},context});merchants.set(offer.name,merchant.id)}
  await payload.create({collection:'offers',data:{...offer,label:`${item.name} — ${offer.name}`,product:product.id,merchant:merchants.get(offer.name)!,active:true,order,sourceData:offer},context});offers++
 }
}
const pages=JSON.parse(await fs.readFile('../migration/admin-expansion/pages.json','utf8'));for(const data of pages)await payload.create({collection:'pages',data,context})
const {site}=await import('../lib/site')
await payload.updateGlobal({slug:'site-settings',data:{siteName:site.name,homeTitle:'Smart Home Guides for Australian Homes',homeDescription:'Independent smart home buying guides, setup help and explainers for Australian homes: lighting, security cameras, energy, climate, robot vacuums and hubs, with Australian retailers and 230V wiring in mind.',contactEmail:site.organisation.email,operator:site.organisation.operator,ogImage:site.ogImage,footerDescription:'Independent smart home buying guides and setup help for Australian homes, covering 230V wiring, AS/NZS standards, renting, Australian retailers and Australian Consumer Law.'},context})
console.log(JSON.stringify({products:all.length,catalogue:source.length,editorial:curated.size,merchants:merchants.size,offers,pages:pages.length}))
await payload.destroy()

process.exit(0)
