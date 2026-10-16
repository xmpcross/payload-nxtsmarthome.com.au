import fs from 'node:fs/promises'
import assert from 'node:assert/strict'
const base='http://127.0.0.1:3022';const before=await fs.readFile('../migration/admin-expansion/sitemap-before.xml','utf8');const after=await(await fetch(base+'/sitemap.xml')).text();const urls=s=>[...s.matchAll(/<loc>(.*?)<\/loc>/g)].map(x=>x[1]).sort();assert.deepEqual(urls(after),urls(before),'Sitemap URLs preserved')
const queue=urls(after);const failures=[];async function check(){while(queue.length){const url=queue.pop();const r=await fetch(base+new URL(url).pathname);if(!r.ok)failures.push([url,r.status]);await r.arrayBuffer()}}await Promise.all(Array.from({length:4},check));assert.deepEqual(failures,[])
for(const route of ['/admin/login/','/contact/','/api/pages/'])assert.equal((await fetch(base+route)).status,200,route)
for(const c of ['products','offers','merchants']){const r=await fetch(base+'/api/'+c+'/',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});assert.ok([401,403].includes(r.status),'Anonymous writes denied for '+c)}
const result={sitemapURLs:urls(after).length,allPagesOK:true,adminLoginPageOK:true,anonymousCommerceWritesDenied:true};await fs.writeFile('../migration/admin-expansion/live-verification.json',JSON.stringify(result,null,2));console.log(result)
