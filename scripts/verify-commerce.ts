import fs from 'node:fs/promises'
import assert from 'node:assert/strict'
if(process.argv.includes('--test-db')){const u=new URL(process.env.DATABASE_URL!);u.pathname='/nxtsmarthome_admin_test';process.env.DATABASE_URL=u.toString()}
const baseline=JSON.parse(await fs.readFile('../migration/admin-expansion/catalogue-before.json','utf8'))
const p=await import('../lib/products');const {getPayload}=await import('payload');const config=(await import('../payload.config')).default
const all=await p.getAllTopProducts();const curated=await p.getAllProducts()
assert.deepEqual(all.map(x=>x.slug).sort(),baseline.all.map((x:any)=>x.slug).sort())
assert.deepEqual(curated.map(x=>x.slug).sort(),baseline.curated.map((x:any)=>x.slug).sort())
for(const old of baseline.all){const current:any=all.find(x=>x.slug===old.slug);for(const field of Object.keys(old)){if(['updatedAt','retailers'].includes(field))continue;assert.deepEqual(current[field],old[field],`${old.slug}: ${field}`)}
 assert.equal(current.retailers.length,old.retailers.length)
 for(let i=0;i<old.retailers.length;i++)for(const key of Object.keys(old.retailers[i]))assert.deepEqual(current.retailers[i][key],old.retailers[i][key],`${old.slug}: offer ${i} ${key}`)
}
for(const old of baseline.curated){const current:any=curated.find(x=>x.slug===old.slug);for(const key of Object.keys(old))assert.deepEqual(current[key],old[key],`${old.slug}: editorial ${key}`)}
assert.deepEqual((await p.getIndexableTopProducts()).map(x=>x.slug).sort(),baseline.indexable.sort(),'Indexable product URLs')
assert.deepEqual((await p.getShoppableTopProducts()).map(x=>x.slug).sort(),baseline.shoppable.sort(),'Shoppable product URLs')
console.log(JSON.stringify({catalogue:all.length,editorial:curated.length,indexable:baseline.indexable.length,shoppable:baseline.shoppable.length,fieldsAndOffersPreserved:true}))
const payload=await getPayload({config});await payload.destroy()

process.exit(0)
