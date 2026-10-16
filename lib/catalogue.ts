import { cache } from 'react'
import { getPayload } from 'payload'
import config from '../payload.config'
// Request-local memoisation avoids stale process-wide catalogue caches.
export const catalogue = cache(async () => {
 const payload=await getPayload({config})
 const [products,offers]=await Promise.all([
  payload.find({collection:'products',where:{active:{equals:true}},limit:0,pagination:false,depth:1,overrideAccess:true}),
  payload.find({collection:'offers',where:{active:{equals:true}},limit:0,pagination:false,depth:1,sort:'order',overrideAccess:true}),
 ])
 const byProduct=new Map<number,any[]>()
 for(const offer of offers.docs as any[]){const merchant=offer.merchant;if(!merchant||typeof merchant!=='object'||merchant.active===false)continue;const id=typeof offer.product==='object'?offer.product.id:offer.product;const rows=byProduct.get(id)??[];const row={...offer.sourceData,name:merchant.name,url:offer.url,primary:offer.primary,deepLink:offer.deepLink,logo:offer.logo||merchant.logo||undefined};if(typeof offer.priceAud==='number')row.priceAud=offer.priceAud;else delete row.priceAud;rows.push(row);byProduct.set(id,rows)}
 return (products.docs as any[]).map(doc=>{
  const row={...(doc.sourceData??{}),...doc,id:doc.legacyId||doc.slug,retailers:byProduct.get(doc.id)??[],editorial:doc.editorial}
  for(const key of Object.keys(row))if(row[key]===null)delete row[key]
  if(doc.imageUpload&&typeof doc.imageUpload==='object')row.image=`/api/media/file/${encodeURIComponent(doc.imageUpload.filename)}`
  delete row.sourceData;delete row.imageUpload
  return row
 })
})
