import LocalDate from '@/components/LocalDate'
import { TPostDetail } from '@/data/posts'
import Avatar from '@/shared/Avatar'
import clsx from 'clsx'
import Link from 'next/link'
import { FC } from 'react'

interface Props extends Pick<TPostDetail, 'date' | 'author' | 'readingTime'> {
  className?: string
  /** Last substantive update. Shown only when it falls on a later day than `date`. */
  updated?: string
}

const DAY = { year: 'numeric', month: 'long', day: 'numeric' } as const

/*
 * "Published 14 January 2026 · Updated 1 August 2026" (audit C8/#17): the byline
 * used to show the modified date alone, unlabelled, so a bulk date bump read as
 * a fresh article.
 */
const SingleMeta: FC<Props> = ({ className, date, updated, author, readingTime }) => {
  const showUpdated = !!updated && updated.slice(0, 10) > String(date).slice(0, 10)
  return (
    <div className={clsx('single-meta relative flex max-w-full min-w-0 items-center text-sm', className)}>
      <Avatar className={'size-10 shrink-0 sm:size-11'} src={author.avatar.src} width={44} height={44} sizes="44px" />

      <div className="ms-3 min-w-0">
        <p className="block font-semibold">{author.name}</p>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 text-[14px] leading-[21px]">
          {/* Each date stays on one line; the row wraps between them instead of
              running off a 390px screen (audit: scrollWidth 465px). */}
          <span className="whitespace-nowrap">
            Published{' '}
            <LocalDate date={date} options={DAY} />
          </span>
          {showUpdated && (
            <>
              <span>·</span>
              <span className="whitespace-nowrap">
                Updated{' '}
                <LocalDate date={updated} options={DAY} />
              </span>
            </>
          )}
          <span>•</span>
          <span className="whitespace-nowrap">{readingTime} min read</span>
        </div>
      </div>

      <Link aria-label={author.name} href={`/authors/${author.handle}/`} className="absolute inset-0" />
    </div>
  )
}

export default SingleMeta
