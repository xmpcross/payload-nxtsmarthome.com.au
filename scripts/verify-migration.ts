import fs from 'node:fs/promises'
import crypto from 'node:crypto'
import assert from 'node:assert/strict'
import {getPayload} from 'payload'
import config from '../payload.config'
const snapshot=JSON.parse(await fs.readFile('../migration/strapi-snapshot.json','utf8'))
const p=await getPayload({config})
const publishedIDs=new Set(snapshot.collections.posts.published.map((x:any)=>x.documentId))
const rows=await p.find({collection:'posts',limit:0,pagination:false,depth:2})
assert.equal(rows.totalDocs,97)
assert.equal(rows.docs.filter(x=>x._status==='published').length,83)
function normalise(s:any){return typeof s==='string'?s.replaceAll(snapshot.base+'/uploads/','/uploads/'):s}
for(const row of rows.docs){const original=(publishedIDs.has(row.legacyId)?snapshot.collections.posts.published:snapshot.collections.posts.draft).find((x:any)=>x.documentId===row.legacyId)
 for(const key of ['title','slug','content','excerpt','seoTitle','seoDescription','keyTakeaways','coverImageUrl','postType','publishedAt','publishDate','dateModified','showFrom']) assert.equal((row as any)[key]??null,normalise(original[key])??null,`${row.slug}: ${key}`)
 assert.deepEqual((row.categories||[]).map((x:any)=>x.slug).sort(),(original.categories||[]).map((x:any)=>x.slug).sort())
 assert.equal((row.author as any)?.slug??null,original.author?.slug??null)
 assert.equal((row.faq||[]).length,(original.faq||[]).length)
}
const media=await p.find({collection:'media',limit:0,pagination:false});assert.equal(media.totalDocs,192)
let altered=0
for(const file of snapshot.files){const bytes=await fs.readFile('../media/uploads/'+file.filename);if(crypto.createHash('sha256').update(bytes).digest('hex')!==file.sha256)altered++}
assert.equal(altered,0,'Downloaded media checksums changed')
const anonymous=await p.find({collection:'posts',limit:0,pagination:false,overrideAccess:false})
assert.equal(anonymous.totalDocs,83,'Public read must hide drafts')
let denied=false;try{await p.create({collection:'posts',data:{title:'Unauthorized',slug:'unauthorized',content:'test'},overrideAccess:false})}catch{denied=true}assert.ok(denied,'Anonymous create must be denied')
const result={checkedAt:new Date().toISOString(),posts:97,published:83,drafts:14,media:192,files:snapshot.files.length,contentMatches:true,mediaHashesMatch:true,publicDraftProtection:true,anonymousWritesDenied:true}
await fs.writeFile('../migration/verification.json',JSON.stringify(result,null,2));console.log(result)
await p.destroy();process.exit(0)
