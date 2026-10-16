import fs from 'node:fs/promises'
import assert from 'node:assert/strict'
const base=process.env.CHECK_BASE||'http://127.0.0.1:3023'
const {email,password}=JSON.parse(await fs.readFile('../migration/admin-expansion/test-credentials.json','utf8'))
const login=await fetch(base+'/api/users/login/',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});assert.equal(login.status,200)
const {token}=await login.json();const headers={Authorization:`JWT ${token}`,'Content-Type':'application/json'}
async function api(p,method='GET',data){const r=await fetch(base+'/api/'+p,{method,headers,body:data?JSON.stringify(data):undefined});assert.ok(r.ok,`${method} ${p}: ${r.status} ${r.ok?'':await r.text()}`);return r.json()}
const counts={};for(const c of ['products','offers','merchants','pages'])counts[c]=(await api(c+'/?limit=1')).totalDocs
const auth={cookies:[{name:'payload-token',value:token,domain:'127.0.0.1',path:'/',expires:-1,httpOnly:true,secure:false,sameSite:'Lax'}],origins:[]};await fs.writeFile('../migration/admin-expansion/browser-auth.json',JSON.stringify(auth),{mode:0o600})
if(process.argv.includes('--read-only')){console.log(JSON.stringify({counts,login:true}));process.exit(0)}
const saved=[]
try{
 const product=(await api('products/?where[slug][equals]=ring-floodlight-cam-wired-plus-white&limit=1')).docs[0]||(await api('products/?where[active][equals]=true&where[catalogueListing][equals]=true&limit=1')).docs[0]
 saved.push(['products/'+product.id+'/',{name:product.name}]);await api('products/'+product.id+'/','PATCH',{name:'CMS verification product title'})
 const html=await(await fetch(base+'/products/'+product.slug+'/')).text();assert.ok(html.includes('CMS verification product title'),'Product edit reaches frontend')
 const offer=(await api('offers/?where[product][equals]='+product.id+'&limit=1')).docs[0];saved.push(['offers/'+offer.id+'/',{priceAud:offer.priceAud??null}]);await api('offers/'+offer.id+'/','PATCH',{priceAud:12.34})
 const priced=await(await fetch(base+'/products/'+product.slug+'/')).text();assert.ok(priced.includes('12.34'),'Offer price reaches product page')
 const merchant=typeof offer.merchant==='object'?offer.merchant:await api('merchants/'+offer.merchant+'/');saved.push(['merchants/'+merchant.id+'/',{name:merchant.name}]);await api('merchants/'+merchant.id+'/','PATCH',{name:'Verified merchant display'});assert.ok((await(await fetch(base+'/products/'+product.slug+'/')).text()).includes('Verified merchant display'),'Merchant edit reaches product page')
 const page=await api('pages/','POST',{title:'Admin verification',slug:'admin-verification-page',bodyHtml:'<h1>Admin verification</h1><p>Published CMS page verification.</p>',_status:'draft'});saved.push(['pages/'+page.doc.id+'/',null]);assert.equal((await fetch(base+'/admin-verification-page/')).status,404)
 await api('pages/'+page.doc.id+'/','PATCH',{_status:'published'});const pageResponse=await fetch(base+'/admin-verification-page/');assert.equal(pageResponse.status,200);assert.ok((await pageResponse.text()).includes('Published CMS page verification.'))
 const settings=await api('globals/site-settings/');saved.push(['globals/site-settings/',{homeTitle:settings.homeTitle}]);await api('globals/site-settings/','POST',{homeTitle:'CMS homepage verification'});assert.ok((await(await fetch(base+'/')).text()).includes('CMS homepage verification'),'Site settings reach homepage')
 console.log(JSON.stringify({counts,productEditing:true,offerEditing:true,merchantEditing:true,pageDraftAndPublish:true,settingsEditing:true}))
}finally{for(const [p,data] of saved.reverse())await api(p,data===null?'DELETE':p.startsWith('globals')?'POST':'PATCH',data??undefined)}
