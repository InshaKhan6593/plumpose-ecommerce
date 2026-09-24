import React from 'react'

/**
 * Shop skeleton (MOTION-SPEC D5): paper blocks in the shape of the grid, with
 * a slow shimmer — never a spinner.
 */
export default function Loading() {
  return (
    <div className="mx-auto max-w-[90rem] px-4 pt-14 md:px-7 md:pt-20" aria-busy aria-label="Loading the collection">
      <div className="mx-auto h-16 w-80 max-w-full animate-pulse bg-paper-3 [animation-duration:1.6s]" />
      <div className="mt-24 grid gap-x-6 gap-y-14 sm:grid-cols-2 lg:grid-cols-3 lg:gap-x-8">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i}>
            <div className="aspect-[4/5] animate-pulse bg-paper-3 [animation-duration:1.6s]" />
            <div className="mt-5 h-7 w-2/3 animate-pulse bg-paper-3 [animation-duration:1.6s]" />
            <div className="mt-3 h-4 w-1/3 animate-pulse bg-paper-3 [animation-duration:1.6s]" />
          </div>
        ))}
      </div>
    </div>
  )
}
