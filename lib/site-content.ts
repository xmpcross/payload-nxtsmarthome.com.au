import { cache } from 'react'
import { getPayload } from 'payload'
import config from '../payload.config'
import { site } from './site'
export const getSettings=cache(async()=>{
 const payload=await getPayload({config});const settings=await payload.findGlobal({slug:'site-settings',overrideAccess:true})
 return {...site,name:settings.siteName||site.name,ogImage:settings.ogImage||site.ogImage,organisation:{...site.organisation,email:settings.contactEmail||site.organisation.email,operator:settings.operator||site.organisation.operator},homeTitle:settings.homeTitle,homeDescription:settings.homeDescription,footerDescription:settings.footerDescription,headingFont:(settings.headingFont as string)||'inter',bodyFont:(settings.bodyFont as string)||'inter'}
})
export const getPage=cache(async(slug:string)=>{
 const payload=await getPayload({config});const result=await payload.find({collection:'pages',where:{and:[{slug:{equals:slug}},{_status:{equals:'published'}}]},limit:1,depth:0,overrideAccess:true});return result.docs[0]??null
})
