import clsx from 'clsx'
import { FC } from 'react'

interface Props {
  title: string
  className?: string
}

const SingleTitle: FC<Props> = ({ className, title }) => {
  return (
    <h1
      className={clsx(
        className,
        'max-w-4xl text-[2rem] leading-[1.22] font-bold tracking-tight text-pretty lg:text-[2.75rem] lg:leading-[1.205]'
      )}
      title={title}
    >
      {title}
    </h1>
  )
}

export default SingleTitle
