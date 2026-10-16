import CmsPage, { pageMetadata } from '@/components/CmsPage'
export const revalidate=300
export const generateMetadata=()=>pageMetadata('terms')
export default function Page(){return <CmsPage slug="terms"/>}
