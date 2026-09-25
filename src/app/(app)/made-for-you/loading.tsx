import React from 'react'

/**
 * Made for You skeleton (MOTION-SPEC D5). The page and its project pages are
 * rendered per request, so without this a click showed nothing until the page
 * was complete. Scoped here rather than to every page on purpose: under a
 * loading boundary a page streams, and `redirect()` can then only redirect in
 * the browser (a meta refresh after a 200) — which would break the real 307s
 * of the account pages and the payment return.
 */
export default function Loading() {
  const block = 'animate-pulse bg-paper-3 [animation-duration:1.6s]'
  return (
    <div
      aria-busy
      aria-label="Loading"
      className="mx-auto max-w-[90rem] px-4 pt-14 md:px-7 md:pt-20"
    >
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
