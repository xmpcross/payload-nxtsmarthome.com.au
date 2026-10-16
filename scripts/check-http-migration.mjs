import fs from 'node:fs/promises'
import assert from 'node:assert/strict'
const base='http://127.0.0.1:3022'
async function sitemap(origin){const r=await fetch(origin+'/sitemap.xml');assert.equal(r.status,200);return [...(await r.text()).matchAll(/<loc>(.*?)<\/loc>/g)].map(x=>x[1])}
const before=await sitemap('http://127.0.0.1:3013'), after=await sitemap(base)
assert.deepEqual([...after].sort(),[...before].sort(),'Public sitemap URL inventory changed')
const queue=[...after],failures=[]
async function worker(){while(queue.length){const url=queue.pop();const r=await fetch(base+new URL(url).pathname);if(!r.ok)failures.push({url,status:r.status});await r.arrayBuffer()}}
await Promise.all(Array.from({length:5},worker));assert.deepEqual(failures,[])
const credentials=await fs.readFile('../migration/admin-credentials.txt','utf8');const password=credentials.match(/Temporary password: (.+)/)[1]
let r=await fetch(base+'/api/users/login/',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'kritin@nxtsmarthome.com.au',password})});assert.equal(r.status,200,'Admin login');const login=await r.json();assert.equal(login.user.role,'admin')
const auth={Authorization:`JWT ${login.token}`,'Content-Type':'application/json'}
r=await fetch(base+'/api/posts/?limit=100');const pub=await r.json();assert.equal(pub.totalDocs,83)
r=await fetch(base+'/api/posts/?limit=100',{headers:auth});const all=await r.json();assert.equal(all.totalDocs,97)
const draft=all.docs.find(x=>x._status==='draft');r=await fetch(base+'/api/posts/'+draft.id+'/');assert.ok([403,404].includes(r.status),'Anonymous draft access')
r=await fetch(base+'/api/posts/',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:'Forbidden',slug:'forbidden',content:'test'})});assert.ok([401,403].includes(r.status))
const media=all.docs.find(x=>x.coverImage)?.coverImage;const imageURL=new URL(media.url,'https://nxtsmarthome.com.au');r=await fetch(base+imageURL.pathname);assert.equal(r.status,200,'Local media API')
r=await fetch(base+'/_next/image/?url='+encodeURIComponent(imageURL.pathname.replace(/\/$/,''))+'&w=640&q=75');assert.equal(r.status,200,'Image optimisation')
// Keep the session private for the browser admin smoke test; no credentials in logs.
const cookie=r.headers.get('set-cookie')
await fs.writeFile('../migration/browser-auth.json',JSON.stringify({cookies:[{name:'payload-token',value:login.token,domain:'127.0.0.1',path:'/',expires:login.exp,httpOnly:true,secure:false,sameSite:'Lax'}],origins:[]}),{mode:0o600})
const summary={checkedAt:new Date().toISOString(),sitemapURLs:after.length,allPublicPagesOK:true,adminLoginOK:true,publicPosts:pub.totalDocs,adminPosts:all.totalDocs,draftsProtected:true,anonymousWritesDenied:true,mediaOK:true,optimisedMediaOK:true}
await fs.writeFile('../migration/http-verification.json',JSON.stringify(summary,null,2));console.log(summary)
