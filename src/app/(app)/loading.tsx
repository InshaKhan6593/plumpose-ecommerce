import React from 'react'

/**
 * The fallback skeleton for every storefront page rendered per request that
 * has no skeleton of its own (Made for You, Contact, Track order, account
 * pages…). A quiet heading and a few lines in paper — never a spinner — so a
 * click always answers at once. Pages prerendered at build time (the
 * homepage, Our Story, FAQ…) are prefetched whole and never show it.
 */
export default function Loading() {
  const block = 'animate-pulse bg-paper-3 [animation-duration:1.6s]'
  return (
    <div aria-busy aria-label="Loading" className="mx-auto max-w-[90rem] px-4 pt-14 md:px-7 md:pt-20">
      <div className={`mx-auto h-16 w-72 max-w-full ${block}`} />
      <div className={`mx-auto mt-6 h-5 w-96 max-w-full ${block}`} />
      <div className="mt-20 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div className={`aspect-[3/4] ${block}`} key={i} />
        ))}
      </div>
    </div>
  )
}
