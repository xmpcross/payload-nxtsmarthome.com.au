import { TPost } from '@/data/posts'
import clsx from 'clsx'
import { FC } from 'react'
import Card18 from './PostCards/Card18'
import Card19 from './PostCards/Card19'

interface Props {
  posts: TPost[]
  className?: string
}

const SectionMagazine10: FC<Props> = ({ posts, className }) => {
  return (
    <div className={clsx('section-magazine-10 relative', className)}>
      {!posts.length && <span>Nothing we found!</span>}
      <div className="grid grid-cols-1 gap-[15px] xl:grid-cols-2">
        <div className="grid grid-cols-1 gap-[15px] sm:grid-cols-2 sm:grid-rows-5">
          {posts
            .filter((_, i) => i < 3 && i >= 1)
            .map((item, index) => (
              // Only the first small card (the LCP on mobile) and the lead card (the LCP
              // on desktop) are preloaded, so the rest do not compete for bandwidth.
              <Card18
                className="col-span-1 sm:row-span-3"
                key={index}
                post={item}
                priority={index === 0}
                // Slot widths: full width less the 16px gutters on phones, half the
                // container from sm, a quarter of the 1366px container from xl.
                sizes="(max-width: 639px) calc(100vw - 32px), (max-width: 1279px) 50vw, 340px"
              />
            ))}

          {posts[3] && (
            <Card19
              ratio="aspect-4/3 sm:aspect-16/1"
              className="sm:col-span-2 sm:row-span-2"
              titleClass="text-xl sm:text-2xl xl:text-2xl"
              post={posts[3]}
              priority={false}
              sizes="(max-width: 1279px) 100vw, 680px"
            />
          )}
        </div>

        {posts[0] && <Card19 post={posts[0]} sizes="(max-width: 1279px) 100vw, 680px" />}
      </div>
    </div>
  )
}

export default SectionMagazine10
