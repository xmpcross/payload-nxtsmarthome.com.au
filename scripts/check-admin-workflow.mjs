import fs from 'node:fs/promises'
import sharp from 'sharp'
import assert from 'node:assert/strict'
const base='http://127.0.0.1:3022'
const password=(await fs.readFile('../migration/admin-credentials.txt','utf8')).match(/Temporary password: (.+)/)[1]
let r=await fetch(base+'/api/users/login/',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'kritin@nxtsmarthome.com.au',password})});assert.equal(r.status,200);const {token}=await r.json();const headers={Authorization:`JWT ${token}`};let mediaID,postID
try {
 const file=await sharp({create:{width:32,height:32,channels:3,background:'#547660'}}).png().toBuffer()
 const form=new FormData();form.set('_payload',JSON.stringify({alt:'Migration upload verification'}));form.set('file',new Blob([file],{type:'image/png'}),`migration-check-${Date.now()}.png`)
 r=await fetch(base+'/api/media/',{method:'POST',headers,body:form});assert.equal(r.status,201);const {doc:media}=await r.json();mediaID=media.id
 const u=new URL(media.url);r=await fetch(base+'/_next/image/?url='+encodeURIComponent(u.pathname.replace(/\/$/,''))+'&w=64&q=75');assert.equal(r.status,200,'New upload must optimise without restart')
 r=await fetch(base+'/api/posts/',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({title:'Migration workflow check',slug:'migration-workflow-check',content:'Temporary migration verification.',coverImage:mediaID,_status:'draft'})});assert.equal(r.status,201);const {doc:post}=await r.json();postID=post.id
 r=await fetch(base+`/api/posts/${postID}/`);assert.ok([403,404].includes(r.status))
 r=await fetch(base+`/api/posts/${postID}/`,{method:'PATCH',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({_status:'published',showFrom:'2099-01-01T00:00:00.000Z'})});assert.equal(r.status,200)
 r=await fetch(base+`/api/posts/${postID}/`);assert.ok([403,404].includes(r.status),'Future publication must stay hidden')
 console.log('Admin upload, new-image optimisation, draft save and scheduled-publication protection passed')
} finally {
 for(const [collection,id] of [['posts',postID],['media',mediaID]])if(id){r=await fetch(base+`/api/${collection}/${id}/`,{method:'DELETE',headers});assert.equal(r.status,200,'Remove verification fixture')}
}
