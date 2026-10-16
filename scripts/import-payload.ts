import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import {getPayload, type CollectionSlug} from 'payload'
import config from '../payload.config'
const snapshot=JSON.parse(await fs.readFile('../migration/strapi-snapshot.json','utf8'))
const payload=await getPayload({config})
const maps:Record<string,Map<string,number>>={media:new Map(),authors:new Map(),categories:new Map(),navigation:new Map(),posts:new Map()}
function localise(x:any):any { if(typeof x==='string')return x.replaceAll(`${snapshot.base}/uploads/`,'/uploads/');if(Array.isArray(x))return x.map(localise);if(x&&typeof x==='object')return Object.fromEntries(Object.entries(x).map(([k,v])=>[k,localise(v)]));return x }
async function upsert(collection:CollectionSlug,legacyId:string,data:any,extra:any={}){
 const found=await payload.find({collection,where:{legacyId:{equals:legacyId}},limit:1,depth:0})
 const doc=found.docs[0] ? await payload.update({collection,id:found.docs[0].id,data:{...data,legacyId}}) : await payload.create({collection,data:{...data,legacyId},...extra})
 maps[collection].set(legacyId,Number(doc.id));return doc
}
for(const file of snapshot.media.filter((x:any)=>x.id)){
 const filename=path.basename(new URL(file.url,snapshot.base).pathname)
 await upsert('media',String(file.id),{alt:file.alternativeText||'',caption:file.caption||''},{filePath:path.resolve('../media/uploads',filename),overwriteExistingFiles:true})
}
function relation(collection:string,x:any){return x ? maps[collection].get(String(collection==='media'?x.id:x.documentId)) : null}
for(const collection of ['categories','authors','navigation'] as const){
 const source=snapshot.collections[collection];const published=new Map(source.published.map((x:any)=>[x.documentId,x]));
 for(const draft of source.draft){const row:any=published.get(draft.documentId)||draft;const data=localise(row);for(const k of ['id','documentId','publishedAt','posts','children','parent'])delete data[k];if(collection==='authors')data.avatar=relation('media',row.avatar);data._status=published.has(row.documentId)?'published':'draft';await upsert(collection,row.documentId,data)}
}
for(const row of snapshot.collections.categories.published){if(row.parent)await payload.update({collection:'categories',id:maps.categories.get(row.documentId)!,data:{parent:relation('categories',row.parent)}})}
const published=new Map(snapshot.collections.posts.published.map((x:any)=>[x.documentId,x]))
for(const draft of snapshot.collections.posts.draft){
 const row:any=published.get(draft.documentId)||draft;const data=localise(row)
 for(const k of ['id','documentId'])delete data[k]
 data.coverImage=relation('media',row.coverImage);data.ogImage=relation('media',row.ogImage);data.gallery=(row.gallery||[]).map((x:any)=>relation('media',x)).filter(Boolean)
 data.author=relation('authors',row.author);data.categories=(row.categories||[]).map((x:any)=>relation('categories',x)).filter(Boolean)
 data.faq=(data.faq||[]).map(({id,...x}:any)=>x);data._status=published.has(row.documentId)?'published':'draft'
 await upsert('posts',row.documentId,data)
}
const users=await payload.count({collection:'users'})
if(!users.totalDocs){const password=crypto.randomBytes(24).toString('base64url');await payload.create({collection:'users',data:{email:'kritin@nxtsmarthome.com.au',password,name:'Kritin',role:'admin'}});await fs.writeFile('../migration/admin-credentials.txt',`URL: https://nxtsmarthome.com.au/admin\nEmail: kritin@nxtsmarthome.com.au\nTemporary password: ${password}\n`,{mode:0o600})}
console.log('Imported',Object.fromEntries(Object.entries(maps).map(([k,v])=>[k,v.size])))
await payload.destroy();process.exit(0)
