'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React from 'react'

import { cn } from '@/utilities/cn'

const LINKS = [
  { href: '/account', label: 'Orders' },
  { href: '/account/addresses', label: 'Addresses' },
  { href: '/account/details', label: 'Your details' },
] as const

/** The account area's own navigation: a column on desktop, a row on a phone. */
export function AccountNav() {
  const pathname = usePathname()

  return (
    <nav aria-label="Your account">
      <ul className="flex flex-wrap gap-x-7 gap-y-3 border-b border-line pb-5 lg:flex-col lg:gap-5 lg:border-b-0 lg:border-l lg:pb-0 lg:pl-5">
        {LINKS.map((link) => {
          const active = pathname === link.href
          return (
            <li key={link.href}>
              <Link
                aria-current={active ? 'page' : undefined}
                className={cn('caps text-[0.625rem] transition-colors', active ? 'text-ink' : 'text-ink-soft hover:text-ink')}
                href={link.href}
              >
                {link.label}
              </Link>
            </li>
          )
        })}
        <li className="lg:mt-4">
          <Link className="caps text-[0.625rem] text-ink-soft transition-colors hover:text-ink" href="/logout">
            Sign out
          </Link>
        </li>
      </ul>
    </nav>
  )
}
