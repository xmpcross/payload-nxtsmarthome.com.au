'use client'

import { Dropdown, DropdownButton, DropdownItem, DropdownMenu } from '@/shared/dropdown'
import { Facebook01Icon, Link01Icon, Mail01Icon, NewTwitterIcon, Share03Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import clsx from 'clsx'
import { FC } from 'react'

const SITE_URL = 'https://nxtsmarthome.com.au'

/** Share menu with working links (the template shipped placeholders). */
function ShareDropdown({ handle, title }: { handle: string; title: string }) {
  const url = `${SITE_URL}/${handle}`
  const u = encodeURIComponent(url)
  const t = encodeURIComponent(title)
  const socialsShare = [
    { name: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${u}`, icon: Facebook01Icon },
    { name: 'X (Twitter)', href: `https://twitter.com/intent/tweet?url=${u}&text=${t}`, icon: NewTwitterIcon },
    { name: 'Email', href: `mailto:?subject=${t}&body=${u}`, icon: Mail01Icon },
  ]

  return (
    <Dropdown>
      <DropdownButton
        as="button"
        aria-label="Share this article"
        className="flex size-11 items-center justify-center rounded-full bg-neutral-50 transition-colors duration-300 hover:bg-neutral-100 dark:bg-white/10 dark:hover:bg-white/20"
      >
        <HugeiconsIcon icon={Share03Icon} size={20} />
      </DropdownButton>
      <DropdownMenu>
        {socialsShare.map((item) => (
          <DropdownItem key={item.name} href={item.href} target="_blank" rel="noopener">
            <HugeiconsIcon icon={item.icon} size={20} data-slot="icon" />
            {item.name}
          </DropdownItem>
        ))}
        <DropdownItem onClick={() => navigator.clipboard?.writeText(url)}>
          <HugeiconsIcon icon={Link01Icon} size={20} data-slot="icon" />
          Copy link
        </DropdownItem>
      </DropdownMenu>
    </Dropdown>
  )
}

interface Props {
  className?: string
  handle: string
  title: string
}

const SingleMetaAction: FC<Props> = ({ className, handle, title }) => {
  return (
    <div className={clsx('single-meta-action', className)}>
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
        <ShareDropdown handle={handle} title={title} />
      </div>
    </div>
  )
}

export { ShareDropdown, SingleMetaAction }
