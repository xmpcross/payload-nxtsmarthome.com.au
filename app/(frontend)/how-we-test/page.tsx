import CmsPage, { pageMetadata } from '@/components/CmsPage'
export const revalidate=300
export const generateMetadata=()=>pageMetadata('how-we-test')
export default function Page(){return <CmsPage slug="how-we-test"/>}
