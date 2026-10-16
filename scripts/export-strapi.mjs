// Read-only export. Run with the original Strapi environment before cutover.
import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
const root=path.resolve('..','migration')
await fs.mkdir(root,{recursive:true,mode:0o700})
const base=process.env.STRAPI_URL.replace(/\/$/,'')
const headers={Authorization:`Bearer ${process.env.STRAPI_TOKEN||process.env.STRAPI_API_TOKEN}`}
const snapshot={exportedAt:new Date().toISOString(),base,collections:{}}
for(const [slug,endpoint] of Object.entries({posts:'nxtsmarthome-posts',authors:'nxtsmarthome-authors',categories:'nxtsmarthome-categories',navigation:'nxtsmart-menus'})){
 snapshot.collections[slug]={}
 for(const status of ['published','draft']){
  const rows=[]
  for(let page=1;;page++){
   const q=new URLSearchParams({status,populate:'*','pagination[pageSize]':'100','pagination[page]':String(page)})
   if(slug==='navigation')q.set('filters[site][$eq]','nxtsmarthome.com.au')
   const r=await fetch(`${base}/api/${endpoint}?${q}`,{headers,signal:AbortSignal.timeout(30000)})
   if(!r.ok)throw Error(`${endpoint}: ${r.status}`)
   const j=await r.json();rows.push(...j.data);if(page>=j.meta.pagination.pageCount)break
  }
  snapshot.collections[slug][status]=rows
 }
}
const media=new Map();const urls=new Set()
function walk(x){if(typeof x==='string'){for(const m of x.matchAll(/(?:https?:\/\/[^\s)"<>]+)?\/uploads\/[^\s)"<>]+/g)){try{const u=new URL(m[0],base);if(u.origin===new URL(base).origin)urls.add(u.href.split('?')[0])}catch{}};return}if(!x||typeof x!=='object')return;if(x.url&&x.hash&&x.mime){media.set(String(x.id||x.hash),x);urls.add(new URL(x.url,base).href)}for(const v of Object.values(x))walk(v)}
walk(snapshot.collections);snapshot.media=[...media.values()]
const dest=path.resolve('../media/uploads');await fs.mkdir(dest,{recursive:true})
const todo=[...urls];const manifest=[]
async function worker(){while(todo.length){const url=todo.pop();const u=new URL(url);if(u.origin!==new URL(base).origin)throw Error('Unexpected media origin');const filename=path.basename(decodeURIComponent(u.pathname));const r=await fetch(url,{signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error(`Media ${filename}: ${r.status}`);const b=Buffer.from(await r.arrayBuffer());await fs.writeFile(path.join(dest,filename),b);manifest.push({url,filename,bytes:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex')})}}
await Promise.all(Array.from({length:6},worker))
snapshot.files=manifest
await fs.writeFile(path.join(root,'strapi-snapshot.json'),JSON.stringify(snapshot,null,2),{mode:0o600})
console.log(JSON.stringify({collections:Object.fromEntries(Object.entries(snapshot.collections).map(([k,v])=>[k,{published:v.published.length,draft:v.draft.length}])),mediaRecords:snapshot.media.length,files:manifest.length,bytes:manifest.reduce((s,x)=>s+x.bytes,0)}))
