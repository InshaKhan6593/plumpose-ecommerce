import React from 'react'

import { HouseAlert } from '@/components/forms/house'
import { PageHeading } from '@/components/editorial'

import { NOTICES, type NoticeCode } from './notices'

export { noticeHref } from './notices'

/** Account pages — shared parts. Redirect messages are codes; see ./notices. */

export function Notice({ code }: { code?: string | string[] }) {
  const key = typeof code === 'string' && code in NOTICES ? (code as NoticeCode) : null
  if (!key) return null
  const notice = NOTICES[key]
  return <HouseAlert tone={notice.tone}>{notice.text}</HouseAlert>
}

/**
 * Sign in, create an account, forgotten password, reset: one narrow column
 * under a centred heading, with the ways between them underneath.
 */
export function AuthShell({
  children,
  footer,
  intro,
  notice,
  title,
}: {
  children: React.ReactNode
  footer?: React.ReactNode
  intro?: string
  notice?: string | string[]
  title: string
}) {
  return (
    <div className="px-4 pt-14 md:pt-20">
      {/* The heading takes the page's width; only the form is kept narrow. */}
      <PageHeading intro={intro} title={title} />
      <div className="mx-auto max-w-md">
        <div className="mt-12 flex flex-col gap-8">
          <Notice code={notice} />
          {children}
        </div>
        {footer ? <div className="mt-14 flex flex-wrap justify-center gap-x-8 gap-y-4 border-t border-line pt-8">{footer}</div> : null}
      </div>
    </div>
  )
}
