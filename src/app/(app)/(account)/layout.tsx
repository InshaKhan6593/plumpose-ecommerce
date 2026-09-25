import type { ReactNode } from 'react'

import React from 'react'

import { AccountNav } from '@/components/account/AccountNav'
import { getSessionUser } from '@/components/account/session'

/**
 * The account area (docs/SCREEN-PROMPTS 17): a small caps label and the
 * customer's name, the account's own navigation beside the page. Each page
 * checks the session itself (`requireUser`), so a signed-out visitor is sent
 * to sign in and brought back to the page they asked for.
 */
export default async function AccountLayout({ children }: { children: ReactNode }) {
  const { user } = await getSessionUser()

  return (
    <div className="mx-auto max-w-[90rem] px-4 pt-14 md:px-7 md:pt-20">
      {user ? (
        <header className="border-b border-line pb-10">
          <p className="caps text-[0.625rem] text-ink-soft">Your account</p>
          <p className="serif-display mt-4 text-[clamp(2.5rem,5vw,4.5rem)]">
            {user.name || user.email}
          </p>
        </header>
      ) : null}
      <div className="grid gap-10 pt-10 lg:grid-cols-[12rem_minmax(0,1fr)] lg:gap-20 lg:pt-14">
        <aside className="lg:sticky lg:top-32 lg:self-start">{user ? <AccountNav /> : null}</aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  )
}
