import {Products,Offers,Merchants,Pages,SiteSettings} from './lib/commerce-config'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildConfig, type CollectionConfig, type Access, type Where, type Field } from 'payload'
import { postgresAdapter } from '@payloadcms/db-postgres'
import sharp from 'sharp'
const dirname = path.dirname(fileURLToPath(import.meta.url))
const authenticated: Access = ({ req }) => Boolean(req.user)
const admin: Access = ({ req }) => req.user?.role === 'admin'
const published: Access = ({ req }) => req.user ? true : { _status: { equals: 'published' } }
const text = (name: string, extra = {}): Field => ({ name, type: 'text', ...extra })
const legacy: Field = text('legacyId', { unique: true, index: true, admin: { readOnly: true, position: 'sidebar' } })
const editorialAccess = { read: published, create: authenticated, update: authenticated, delete: admin }
const Users: CollectionConfig = {
 slug: 'users', auth: true, admin: { useAsTitle: 'email', group: 'Admin' },
 access: { create: admin, read: ({ req }) => req.user?.role === 'admin' ? true : { id: { equals: req.user?.id } }, update: admin, delete: admin },
 fields: [text('name'), { name: 'role', type: 'select', required: true, defaultValue: 'editor', options: ['admin','editor'], access: { create: ({req}) => req.user?.role === 'admin', update: ({req}) => req.user?.role === 'admin' } }],
}
const Media: CollectionConfig = {
 slug: 'media', admin: { group: 'Content' }, access: { read: () => true, create: authenticated, update: authenticated, delete: admin },
 upload: { staticDir: path.resolve(dirname, '../media/uploads'), mimeTypes: ['image/*'], focalPoint: false },
 fields: [legacy, text('alt'), text('caption')],
}
const Authors: CollectionConfig = { slug: 'authors', admin: {useAsTitle:'name',group:'Content'}, access:editorialAccess, versions:{drafts:true}, fields:[legacy,text('name',{required:true}),text('slug',{required:true,unique:true}),text('role'),{name:'bio',type:'textarea'},{name:'sameAs',type:'json'},{name:'avatar',type:'upload',relationTo:'media'}] }
const Categories: CollectionConfig = { slug:'categories',admin:{useAsTitle:'name',group:'Content'},access:editorialAccess,versions:{drafts:true},fields:[legacy,text('name',{required:true}),text('slug',{required:true,unique:true}),{name:'description',type:'textarea'},{name:'order',type:'number'},text('icon'),{name:'parent',type:'relationship',relationTo:'categories'}] }
const Navigation: CollectionConfig = {slug:'navigation',labels:{singular:'Navigation item',plural:'Navigation'},admin:{useAsTitle:'title',group:'Admin'},access:editorialAccess,versions:{drafts:true},fields:[legacy,text('title',{required:true}),text('slug'),text('url',{required:true}),text('site'),text('group'),text('emoji'),{name:'order',type:'number'},{name:'isActive',type:'checkbox',defaultValue:true},text('target')]}
const Posts: CollectionConfig = {
 slug:'posts',labels:{singular:'Article',plural:'Articles'},hooks:{beforeChange:[({data,originalDoc})=>{if(data._status==='published'&&!data.publishedAt&&!originalDoc?.publishedAt)data.publishedAt=new Date().toISOString();return data}]},admin:{useAsTitle:'title',group:'Content',defaultColumns:['title','_status','publishDate']},access:{...editorialAccess,read:({req})=>req.user?true:({and:[{_status:{equals:'published'}},{or:[{showFrom:{exists:false}},{showFrom:{less_than_equal:new Date().toISOString()}}]}]} as Where)},versions:{drafts:true},
 fields:[legacy,text('title',{required:true}),text('slug',{required:true,unique:true}),{name:'excerpt',type:'textarea'},
 {name:'content',type:'textarea',required:true,admin:{description:'Markdown article body. Preserve ::product:slug:: markers for inline product cards.'}},
 {name:'keyTakeaways',type:'textarea'}, {name:'coverImage',type:'upload',relationTo:'media'},text('coverImageUrl'),text('coverImageAlt'),{name:'gallery',type:'upload',relationTo:'media',hasMany:true},{name:'ogImage',type:'upload',relationTo:'media'},
 {name:'postType',type:'select',options:['how-to-guide','product-comparison','product-roundup','informative','buying-guide','pillar','review','product-review','other']},
 ...['publishDate','dateModified','showFrom','publishedAt'].map(name=>({name,type:'date',admin:{date:{pickerAppearance:'dayAndTime'}}} as Field)),
 {name:'featured',type:'checkbox'}, {name:'tags',type:'json'},{name:'readingTimeMinutes',type:'number'},
 ...['seoTitle','seoDescription','seoKeywords','sourceUrl','amazonAffiliateTag','source'].map(name=>text(name)),
 {name:'faq',type:'array',fields:[text('q'),{name:'a',type:'textarea'},text('question'),{name:'answer',type:'textarea'}]},
 {name:'categories',type:'relationship',relationTo:'categories',hasMany:true},{name:'author',type:'relationship',relationTo:'authors'}]
}
export default buildConfig({
 secret:process.env.PAYLOAD_SECRET || '', serverURL:process.env.SITE_URL || 'https://nxtsmarthome.com.au',
 admin:{
  user:'users', importMap:{baseDir:dirname},
  meta:{titleSuffix:' – NXT Smart Home admin'},
  components:{
   beforeNav:['/components/admin/BackToDashboard#BackToDashboard'],
   actions:['/components/admin/ViewSiteAction#ViewSiteAction'],

  },
 },
 collections:[Posts,Categories,Authors,Pages,Media,Products,Offers,Merchants,Navigation,Users],
 globals:[SiteSettings],
 db:postgresAdapter({pool:{connectionString:process.env.DATABASE_URL,max:10},push:process.env.PAYLOAD_DB_PUSH==='true',migrationDir:path.resolve(dirname,'migrations')}),
 sharp,typescript:{outputFile:path.resolve(dirname,'payload-types.ts')},
 csrf:['https://nxtsmarthome.com.au'],
})
