'use client'

import { Search, User, X } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React, { Suspense, useEffect, useState } from 'react'

import { Wordmark } from '@/components/brand/Wordmark'
import { Cart } from '@/components/Cart'
import { OpenCartButton } from '@/components/Cart/OpenCart'
import { cn } from '@/utilities/cn'

export const NAV = [
  { href: '/shop', label: 'Shop' },
  { href: '/made-for-you', label: 'Made for you' },
  { href: '/our-story', label: 'Our story' },
  { href: '/find-order', label: 'Track order' },
] as const

/** Past this, the header condenses (MOTION-SPEC D3). */
const CONDENSE_AT = 80

/**
 * The announcement line. On a phone the full "RESORT 2026 · NOW SHIPPING
 * WORLDWIDE · …" wraps to two lines and eats the first screen, so there it
 * shows one phrase at a time, crossfading every few seconds. The first phrase
 * is rendered on the server, so nothing jumps when the script arrives. Screen
 * readers get the whole line once; reduced motion keeps the first phrase still.
 */
function AnnouncementBar({ text }: { text: string }) {
  const parts = text.split(/\s*·\s*/).filter(Boolean)
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (parts.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const id = window.setInterval(() => setIndex((n) => (n + 1) % parts.length), 4000)
    return () => window.clearInterval(id)
  }, [parts.length])

  return (
    <div className="bg-ink px-4 py-2.5 text-center text-white">
      <p className="sr-only">{text}</p>

      <p aria-hidden className="caps hidden text-[0.625rem] leading-relaxed md:block">
        {text}
      </p>

      <p aria-hidden className="caps relative h-4 text-[0.625rem] leading-4 md:hidden">
        {parts.map((part, n) => (
          <span
            className={cn(
              'absolute inset-0 transition-opacity duration-700 ease-brand',
              n === index ? 'opacity-100' : 'opacity-0',
            )}
            key={part}
          >
            {part}
          </span>
        ))}
      </p>
    </div>
  )
}

export function SiteHeaderClient({ announcement }: { announcement: null | string }) {
  const pathname = usePathname()
  const [condensed, setCondensed] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setCondensed(window.scrollY > CONDENSE_AT)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => setMenuOpen(false), [pathname])

  /**
   * On the homepage the header sits over the full-screen film, in white, like
   * the client's reference; once the page scrolls it becomes paper and ink.
   * Its height never changes — condensing only shrinks the wordmark and adds
   * the background — so nothing below it jumps when it condenses.
   */
  const onHome = pathname === '/'
  const overlay = onHome && !condensed && !menuOpen

  return (
    <>
      {announcement ? <AnnouncementBar text={announcement} /> : null}

      <header
        className={cn(
          'sticky top-0 z-40 transition-[background-color,color] duration-500 ease-brand',
          overlay ? 'bg-transparent text-white' : condensed ? 'bg-background/95 text-ink backdrop-blur-sm' : 'bg-background text-ink',
          // Over the film on the homepage: take no space, so the film starts at the top.
          onHome && '-mb-20 md:-mb-24',
        )}
      >
        <div
          className={cn(
            'mx-4 grid h-20 grid-cols-[1fr_auto_1fr] items-center border-b transition-colors duration-500 ease-brand md:mx-7 md:h-24',
            overlay ? 'border-white/25' : 'border-line',
          )}
        >
          {/* Left: navigation (desktop) / menu (mobile) */}
          <nav aria-label="Main" className="flex items-center">
            <button
              aria-expanded={menuOpen}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              className="-ml-1 p-1 lg:hidden"
              onClick={() => setMenuOpen((open) => !open)}
              type="button"
            >
              {menuOpen ? (
                <X className="size-5" strokeWidth={1.25} />
              ) : (
                <span aria-hidden className="flex w-5 flex-col gap-1.5">
                  <span className="h-px w-full bg-current" />
                  <span className="h-px w-full bg-current" />
                </span>
              )}
            </button>

            {/*
              Inline from 1024px only. The links need ~363px on one line at
              gap-6 (~411px at gap-10); the header's side column is 266px at
              768 and 394px at 1024, so from md they wrapped into
              "MADE / FOR / YOU". Tablets get the menu button instead.
            */}
            <ul className="hidden items-center gap-6 lg:flex xl:gap-10">
              {NAV.map((item) => (
                <li key={item.href}>
                  <Link
                    className={cn(
                      'caps relative text-[0.625rem] whitespace-nowrap transition-opacity hover:opacity-60',
                      pathname.startsWith(item.href) &&
                        'after:absolute after:inset-x-0 after:-bottom-1.5 after:h-px after:bg-current',
                    )}
                    href={item.href}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Centre: the wordmark */}
          <Link aria-label="plumpose — home" href="/">
            <Wordmark
              className={cn(
                'w-auto transition-[height] duration-500 ease-brand',
                condensed ? 'h-6' : 'h-7 md:h-9',
              )}
            />
          </Link>

          {/* Right: currency, search, account, bag */}
          <div className="flex items-center justify-end gap-4 md:gap-5">
            <span className="caps hidden border-r border-current/25 pr-5 text-[0.625rem] md:inline">QAR</span>
            <Link aria-label="Search" className="hidden md:block" href="/shop">
              <Search className="size-[1.15rem]" strokeWidth={1.25} />
            </Link>
            <Link aria-label="Account" className="hidden md:block" href="/account">
              <User className="size-[1.15rem]" strokeWidth={1.25} />
            </Link>
            <Suspense fallback={<OpenCartButton />}>
              <Cart />
            </Suspense>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen ? (
          <nav
            aria-label="Main"
            className="absolute inset-x-0 top-full h-[calc(100dvh-100%)] bg-background px-6 pt-10 text-ink lg:hidden"
          >
            <ul className="flex flex-col gap-7">
              {NAV.map((item) => (
                <li key={item.href}>
                  <Link className="serif-display text-4xl" href={item.href}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-12 flex gap-8 border-t border-line pt-6">
              <Link className="caps text-[0.625rem]" href="/account">
                Account
              </Link>
              <span className="caps text-[0.625rem] text-ink-soft">QAR</span>
            </div>
          </nav>
        ) : null}
      </header>
    </>
  )
}
