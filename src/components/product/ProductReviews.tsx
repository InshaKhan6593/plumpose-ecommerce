import React from 'react'

import type { Review } from '@/payload-types'

import { Reveal } from '@/motion/Reveal'

import { ReviewForm } from './ReviewForm'
import { averageRating, Stars } from './Stars'

const dateFormat = new Intl.DateTimeFormat('en-GB', { month: 'long', timeZone: 'Asia/Qatar', year: 'numeric' })

/**
 * The reviews of one piece, under the product (REQUIREMENTS S18): the average
 * and the count, every approved review with her reply, and the form.
 * Only approved reviews are passed in — nothing pending is ever rendered.
 */
export function ProductReviews({ productId, reviews }: { productId: number; reviews: Review[] }) {
  const average = averageRating(reviews.map((r) => r.rating))

  return (
    <section aria-labelledby="reviews-heading" className="mx-auto max-w-[90rem] scroll-mt-28 px-4 pt-24 md:px-7 md:pt-32" id="reviews">
      <Reveal className="grid gap-12 border-t border-line pt-14 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:gap-20">
        <div data-reveal>
          <h2 className="serif-display text-[clamp(2.25rem,3.6vw,3.25rem)] leading-[1.05]" id="reviews-heading">
            In your words
          </h2>
          {average !== null ? (
            <div className="mt-6 flex items-center gap-4">
              <Stars size={16} value={average} />
              <p className="text-[0.9375rem] text-ink-soft tabular-nums">
                {average.toFixed(1)} · {reviews.length} {reviews.length === 1 ? 'review' : 'reviews'}
              </p>
            </div>
          ) : (
            <p className="mt-6 text-[0.9375rem] leading-relaxed text-ink-soft">No reviews yet. If you have worn this piece, we would love to hear.</p>
          )}
          <div className="mt-10">
            <ReviewForm productId={productId} />
          </div>
        </div>

        {reviews.length ? (
          <ol className="flex flex-col divide-y divide-line">
            {reviews.map((review) => (
              <li className="py-9 first:pt-0" data-reveal key={review.id}>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                  <Stars value={review.rating} />
                  {review.verifiedPurchase ? <span className="caps text-[0.5625rem] text-ink-soft">Verified purchase</span> : null}
                </div>
                {review.title ? <h3 className="serif-display mt-4 text-[1.5rem] leading-snug">{review.title}</h3> : null}
                <p className="mt-3 max-w-2xl text-[0.9375rem] leading-[1.75] whitespace-pre-line text-ink">{review.body}</p>
                <p className="caps mt-5 text-[0.5625rem] text-ink-soft">
                  {review.name} · {dateFormat.format(new Date(review.createdAt))}
                </p>
                {review.reply ? (
                  <div className="mt-6 max-w-2xl border-l border-ink pl-5">
                    <p className="caps text-[0.5625rem] text-ink-soft">plumpose replied</p>
                    <p className="mt-2 text-[0.9375rem] leading-[1.75] whitespace-pre-line text-ink-soft">{review.reply}</p>
                  </div>
                ) : null}
              </li>
            ))}
          </ol>
        ) : null}
      </Reveal>
    </section>
  )
}
