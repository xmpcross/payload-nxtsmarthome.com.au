import type { CollectionConfig, GlobalConfig, Field } from 'payload'
import { revalidatePath } from 'next/cache'
const auth=({req}:any)=>Boolean(req.user)
const admin=({req}:any)=>req.user?.role==='admin'
const access={read:auth,create:auth,update:auth,delete:admin}
const text=(name:string,extra:any={}):Field=>({name,type:'text',...extra})
const json=(name:string,extra:any={}):Field=>({name,type:'json',...extra})
const refresh=({doc,req}:any)=>{if(!req.context?.skipRevalidation){try{revalidatePath('/','layout')}catch{/* CLI import has no Next cache context. */}}return doc}
const hooks={afterChange:[refresh],afterDelete:[refresh]}
const url=(value:any)=>!value||/^(https?:\/\/|\/)/i.test(value)?true:'Use an https:// URL or a local /path.'
export const Products:CollectionConfig={slug:'products',admin:{group:'Commerce',useAsTitle:'name',defaultColumns:['name','brand','categoryName','active']},access,hooks,fields:[
 text('legacyId',{unique:true,index:true,admin:{readOnly:true}}),text('name',{required:true}),text('slug',{required:true,unique:true,index:true,admin:{description:'Changing this changes the product URL; preserve existing slugs unless you also add a redirect.'}}),text('brand'),
 {name:'active',type:'checkbox',defaultValue:true}, {name:'catalogueListing',type:'checkbox',defaultValue:true,admin:{description:'Include in the main product catalogue. Existing editorial-only products are kept separate.'}},
 text('categoryKey'),text('categorySlug'),text('categoryName'),text('subCategory'),text('bestFor'),text('image',{validate:url}),{name:'imageUpload',type:'upload',relationTo:'media'},
 {name:'priceAud',type:'number',min:0},text('currency',{defaultValue:'AUD'}),{name:'description',type:'textarea'},{name:'shortDescription',type:'textarea'},{name:'cmsDescriptionHtml',type:'textarea',admin:{description:'Editorial HTML. Preserve the original factual claims.'}},
 json('pros'),json('cons'),json('specifications'),json('reviews',{admin:{description:'Imported genuine customer reviews only. Do not invent reviews or ratings.'}}),
 ...['rating','ratingReal','reviewCount','reviewCountReal'].map(name=>({name,type:'number',admin:{description:'Only verified source data; do not invent ratings.'}} as Field)),
 text('googleProductId'),json('descriptionRewrite'),
 {name:'editorial',type:'group',fields:[{name:'enabled',type:'checkbox'},text('name'),text('brand'),text('bestFor'),json('pros'),json('cons'),{name:'note',type:'textarea',admin:{description:'Markdown editorial body.'}},json('match'),json('identifiers'),json('retailers',{admin:{description:'Legacy editorial-only links. Catalogue purchase links are managed in Offers.'}}),text('image'),{name:'rating',type:'number'}]},
 json('sourceData',{admin:{hidden:true,readOnly:true,description:'Original import metadata, retained for lossless migration.'}}),
 ]}
export const Merchants:CollectionConfig={slug:'merchants',admin:{group:'Commerce',useAsTitle:'name',defaultColumns:['name','website','active']},access,hooks,fields:[text('name',{required:true,unique:true}),text('website',{validate:url}),text('logo',{validate:url}),{name:'active',type:'checkbox',defaultValue:true}]}
export const Offers:CollectionConfig={slug:'offers',admin:{group:'Commerce',useAsTitle:'label',defaultColumns:['label','merchant','priceAud','active']},access,hooks,fields:[text('label',{required:true}),{name:'product',type:'relationship',relationTo:'products',required:true,index:true},{name:'merchant',type:'relationship',relationTo:'merchants',required:true},text('url',{required:true,validate:url}),{name:'priceAud',type:'number',min:0},{name:'primary',type:'checkbox'},{name:'deepLink',type:'checkbox'},{name:'active',type:'checkbox',defaultValue:true},{name:'order',type:'number',defaultValue:0},text('logo',{validate:url}),json('sourceData',{admin:{hidden:true,readOnly:true}})]}
export const Pages:CollectionConfig={slug:'pages',admin:{group:'Content',useAsTitle:'title',defaultColumns:['title','slug','_status']},access:{...access,read:({req})=>req.user?true:{_status:{equals:'published'}}},versions:{drafts:true},hooks,fields:[text('title',{required:true}),text('slug',{required:true,unique:true,validate:(value:any)=>/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value||'')&&!['admin','api','products','articles','categories','authors','search','sitemap','all-topics'].includes(value)?true:'Use a unique lowercase URL slug; built-in routes cannot be replaced.'}),text('seoTitle'),{name:'seoDescription',type:'textarea'},{name:'bodyHtml',type:'textarea',required:true,admin:{description:'Page HTML. Scripts and unsafe markup are removed when rendered. Contact form is managed separately and remains functional.'}}]}
const fontOptions=[{label:'Inter',value:'inter'},{label:'Urbanist',value:'urbanist'},{label:'Outfit',value:'outfit'}]
export const SiteSettings:GlobalConfig={slug:'site-settings',label:'Site settings',admin:{group:'Admin'},access:{read:auth,update:admin},hooks:{afterChange:[refresh]},fields:[
 text('siteName',{required:true}),text('homeTitle',{required:true}),{name:'homeDescription',type:'textarea',required:true},text('contactEmail',{required:true}),text('operator'),text('ogImage',{validate:url}),{name:'footerDescription',type:'textarea'},
 {name:'headingFont',type:'select',defaultValue:'inter',options:fontOptions,admin:{description:'Font family used for headings (h1–h6) on the frontend.'}},
 {name:'bodyFont',type:'select',defaultValue:'inter',options:fontOptions,admin:{description:'Font family used for body text, navigation and UI labels.'}},
]}
