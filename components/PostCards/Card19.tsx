import PostFeaturedMedia from '@/components/PostFeaturedMedia/PostFeaturedMedia'
import { TPost } from '@/data/posts'
import clsx from 'clsx'
import Image from 'next/image'
import Link from 'next/link'
import { FC } from 'react'
import CategoryBadgeList from '../CategoryBadgeList'
import PostCardCommentBtn from '../PostCardCommentBtn'
import PostCardLikeBtn from '../PostCardLikeBtn'
import PostCardSaveBtn from '../PostCardSaveBtn'
import PostTypeFeaturedIcon from '../PostTypeFeaturedIcon'

interface Props {
  className?: string
  ratio?: string
  titleClass?: string
  post: TPost
  /** Preload the image. Only for a card that can be the page's LCP element. */
  priority?: boolean
  /** The image's `sizes`; pass a tight value where the card's slot is known. */
  sizes?: string
}

const Card19: FC<Props> = ({
  className,
  titleClass = 'text-xl sm:text-2xl xl:text-3xl',
  ratio = 'aspect-4/3 sm:aspect-1/1',
  post,
  priority = true,
  sizes = '(max-width: 1024px) 100vw, 50vw',
}) => {
  const { title, handle, featuredImage, categories, postType, likeCount, liked, commentCount, bookmarked } = post

  return (
    <div className={clsx('group post-card-19 relative flex flex-col overflow-hidden rounded-xl', className)}>
      <div className={clsx('relative size-full', ratio)}>
        {postType === 'audio' ? (
          <PostFeaturedMedia post={post} />
        ) : (
          <>
            <Image
              sizes={sizes}
              className="rounded-xl object-cover brightness-100 transition-[filter] duration-300 group-hover:brightness-75"
              src={featuredImage}
              alt={title}
              preload={priority}
              fetchPriority={priority ? 'high' : undefined}
              fill
            />
            <PostTypeFeaturedIcon
              className="absolute end-4 top-4 group-hover:hidden"
              postType={postType}
              wrapSize="size-7"
              iconSize="size-4"
            />
            <Link href={`/${handle}`} className="absolute inset-0" aria-label={title}></Link>
          </>
        )}
      </div>

      {/* Decorative gradient: a div, not a third nameless link to the same post.
          pointer-events-none lets clicks reach the image link beneath it. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 block h-1/2 bg-linear-to-t from-black opacity-80"
      />

      <div className="absolute inset-x-0 top-0 flex flex-wrap gap-x-2 gap-y-1 p-5 opacity-0 transition-opacity duration-300 group-hover:opacity-100 sm:px-7">
        <PostCardLikeBtn likeCount={likeCount} liked={liked} />
        <PostCardCommentBtn commentCount={commentCount} handle={handle} />
        <PostCardSaveBtn className="ms-auto" bookmarked={bookmarked} />
      </div>

      <div className="absolute inset-x-0 bottom-0 flex grow flex-col p-5 sm:p-8">
        <Link href={`/${handle}`} className="absolute inset-0" aria-hidden="true" tabIndex={-1} />
        <CategoryBadgeList categories={categories} />
        <h2 className={clsx('mt-3 block font-semibold text-white line-clamp-2', titleClass)}>{title}</h2>
      </div>
    </div>
  )
}

export default Card19
