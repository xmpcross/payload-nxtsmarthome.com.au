import { getPayload } from 'payload'
import config from '../payload.config'
import type { CollectionSlug } from 'payload'

export async function cmsDocuments(collection: CollectionSlug, { includeDrafts = false, includeScheduled = false } = {}) {
 const payload = await getPayload({config})
 const where: any = includeDrafts ? {} : {_status:{equals:'published'}}
 if(collection==='posts' && !includeScheduled) where.or=[{showFrom:{exists:false}},{showFrom:{less_than_equal:new Date().toISOString()}}]
 const result = await payload.find({collection,where,limit:0,pagination:false,depth:2,overrideAccess:true,sort:collection==='posts'?'-publishDate':'id'})
 return result.docs.map(localMediaURLs)
}
export async function closeCMS() { const p=await getPayload({config}); await p.destroy() }

// Use same-origin file API URLs without the filename's trailing slash. This
// avoids a redirect inside Next's image optimiser and supports new uploads
// immediately, without restarting the server to refresh its public-file list.
function localMediaURLs(value: any): any {
 if (Array.isArray(value)) return value.map(localMediaURLs)
 if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key,v]) => [key, key === 'url' && typeof v === 'string' ? localMediaURL(v) : localMediaURLs(v)]))
 return value
}
function localMediaURL(value: string): string {
 const origin = process.env.SITE_URL || 'https://nxtsmarthome.com.au'
 const u = new URL(value, origin)
 if (u.origin === new URL(origin).origin && u.pathname.startsWith('/api/media/file/')) return u.pathname.replace(/\/$/, '')
 return value
}
