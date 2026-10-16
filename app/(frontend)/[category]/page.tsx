import CmsPage, { pageMetadata } from '@/components/CmsPage'
export const revalidate=300
export async function generateMetadata({params}:{params:Promise<{category:string}>}){return pageMetadata((await params).category)}
export default async function Page({params}:{params:Promise<{category:string}>}){return <CmsPage slug={(await params).category}/> }
