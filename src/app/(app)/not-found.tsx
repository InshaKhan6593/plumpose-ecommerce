import Link from 'next/link'
import React from 'react'

/**
 * Page not found, in the house style rather than the template's bare "404".
 * Also what the header's links to not-yet-built pages land on for now, so it
 * offers the way back into the shop rather than a dead end.
 */
export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-6 py-24 text-center">
      <p className="caps text-[0.625rem] text-ink-soft">Page not found</p>
      <h1 className="serif-display mt-5 text-5xl md:text-6xl">Nothing here, yet.</h1>
      <p className="mt-5 text-[0.9375rem] leading-relaxed text-ink-soft">
        The page you were looking for has moved or doesn’t exist.
      </p>
      <div className="mt-10 flex flex-wrap items-center justify-center gap-6">
        <Link
          className="caps bg-ink px-8 py-4 text-[0.6875rem] text-white hover:bg-ink/85"
          href="/shop"
        >
          Visit the shop
        </Link>
        <Link className="caps border-b border-ink pb-1 text-[0.6875rem]" href="/">
          Home
        </Link>
      </div>
    </div>
  )
}
