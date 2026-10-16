import CmsPage, { pageMetadata } from '@/components/CmsPage'
export const revalidate=300
export const generateMetadata=()=>pageMetadata('contact')
export default function Page(){return <CmsPage slug="contact"/>}
