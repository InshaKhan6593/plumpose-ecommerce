import React from 'react'

/**
 * Product page skeleton (MOTION-SPEC D5), in the page's own shape: the photo
 * on the left, the buying column on the right.
 *
 * The product page is rendered per request (it shows live stock), so without
 * this the browser kept the previous page on screen, with nothing to show the
 * click had registered, until the whole product page arrived. With it, Next
 * prefetches this shell and switches to it the moment a link is clicked
 * (node_modules/next/dist/docs/01-app/01-getting-started/04-linking-and-navigating.md,
 * "Dynamic routes without loading.tsx").
 */
export default function Loading() {
  const block = 'animate-pulse bg-paper-3 [animation-duration:1.6s]'
  return (
    <div
      aria-busy
      aria-label="Loading the piece"
      className="mx-auto grid max-w-[90rem] gap-10 px-4 pt-8 md:px-7 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-20 lg:pt-10"
    >
      <div className={`aspect-[4/5] ${block}`} />
      <div className="lg:pt-6 lg:pr-10 xl:pr-20">
        <div className={`h-3 w-24 ${block}`} />
        <div className={`mt-6 h-14 w-4/5 ${block}`} />
        <div className={`mt-4 h-7 w-1/2 ${block}`} />
        <div className={`mt-8 h-5 w-28 ${block}`} />
        <div className={`mt-10 h-24 w-full max-w-lg ${block}`} />
        <div className="mt-10 flex gap-3">
          {[0, 1, 2].map((i) => (
            <div className={`size-12 ${block}`} key={i} />
          ))}
        </div>
        <div className={`mt-8 h-12 w-full max-w-lg ${block}`} />
      </div>
    </div>
  )
}
