'use client'

import React, { useState } from 'react'

import { HouseAlert, HouseButton, HouseField, houseInput } from '@/components/forms/house'
import { cn } from '@/utilities/cn'

type Errors = Partial<Record<'body' | 'email' | 'name' | 'product' | 'rating' | 'title', string>>

/**
 * "Write a review" (REQUIREMENTS S18). Sends to the reviews collection; the
 * server checks everything again (@/hooks/validateReview) and every review
 * waits for her approval before it shows.
 */
export function ReviewForm({ productId }: { productId: number }) {
  const [open, setOpen] = useState(false)
  const [rating, setRating] = useState(0)
  const [hover, setHover] = useState(0)
  const [errors, setErrors] = useState<Errors>({})
  const [failure, setFailure] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  if (sent) {
    return (
      <HouseAlert tone="note">
        Thank you — your review has reached us. It will appear here once we have read it.
      </HouseAlert>
    )
  }

  if (!open) {
    return (
      <HouseButton onClick={() => setOpen(true)} type="button" variant="outline">
        Write a review
      </HouseButton>
    )
  }

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const local: Errors = {}
    if (!rating) local.rating = 'Please choose from one to five stars.'
    if (String(form.get('body') ?? '').trim().length < 10)
      local.body = 'Please write a few words — at least a sentence.'
    setErrors(local)
    setFailure('')
    if (Object.keys(local).length) return

    setSending(true)
    try {
      const res = await fetch('/api/reviews', {
        body: JSON.stringify({
          body: form.get('body'),
          email: form.get('email'),
          name: form.get('name'),
          product: productId,
          rating,
          title: form.get('title') || undefined,
        }),
        credentials: 'omit',
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      })
      if (res.ok) {
        setSent(true)
        return
      }
      // Payload's validation errors: [{ data: { errors: [{ path, message }] } }]
      const json = (await res.json().catch(() => null)) as null | {
        errors?: Array<{
          data?: { errors?: Array<{ message: string; path: string }> }
          message?: string
        }>
      }
      const fieldErrors: Errors = {}
      for (const e of json?.errors ?? [])
        for (const f of e.data?.errors ?? []) fieldErrors[f.path as keyof Errors] = f.message
      if (Object.keys(fieldErrors).length) setErrors(fieldErrors)
      else setFailure('That didn’t send. Please try again in a moment.')
    } catch {
      setFailure('That didn’t send. Please check your connection and try again.')
    } finally {
      setSending(false)
    }
  }

  const shown = hover || rating

  return (
    <form className="flex max-w-xl flex-col gap-7" noValidate onSubmit={submit}>
      <div>
        <p className="caps text-[0.5625rem] text-ink-soft" id="review-rating-label">
          Your rating
        </p>
        <div
          aria-labelledby="review-rating-label"
          className="mt-3 flex gap-1"
          onMouseLeave={() => setHover(0)}
          role="radiogroup"
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              aria-checked={rating === n}
              aria-label={`${n} ${n === 1 ? 'star' : 'stars'}`}
              className="p-1 text-ink transition-transform hover:scale-110"
              key={n}
              onClick={() => setRating(n)}
              onMouseEnter={() => setHover(n)}
              role="radio"
              type="button"
            >
              <svg
                aria-hidden
                fill={n <= shown ? 'currentColor' : 'none'}
                height={24}
                stroke="currentColor"
                strokeWidth={1.2}
                viewBox="0 0 24 24"
                width={24}
              >
                <path
                  d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          ))}
        </div>
        {errors.rating ? (
          <p className="mt-2 text-[0.8125rem] text-[#8a2424]">{errors.rating}</p>
        ) : null}
      </div>

      <div className="grid gap-7 sm:grid-cols-2">
        <HouseField error={errors.name} id="review-name" label="Your name">
          <input
            aria-invalid={Boolean(errors.name)}
            autoComplete="name"
            className={houseInput}
            id="review-name"
            maxLength={80}
            name="name"
            required
          />
        </HouseField>
        <HouseField
          error={errors.email}
          hint="Never shown. Only so we can reply if needed."
          id="review-email"
          label="Email"
        >
          <input
            aria-invalid={Boolean(errors.email)}
            autoComplete="email"
            className={houseInput}
            id="review-email"
            name="email"
            required
            type="email"
          />
        </HouseField>
      </div>

      <HouseField error={errors.title} id="review-title" label="Title (optional)">
        <input className={houseInput} id="review-title" maxLength={120} name="title" />
      </HouseField>

      <HouseField error={errors.body} id="review-body" label="Your review">
        <textarea
          aria-invalid={Boolean(errors.body)}
          className={cn(houseInput, 'min-h-32 resize-y')}
          id="review-body"
          maxLength={2000}
          name="body"
          required
        />
      </HouseField>

      {errors.product ? <HouseAlert>{errors.product}</HouseAlert> : null}
      {failure ? <HouseAlert>{failure}</HouseAlert> : null}

      <div className="flex flex-wrap items-center gap-6">
        <HouseButton disabled={sending}>{sending ? 'Sending…' : 'Send review'}</HouseButton>
        <p className="text-[0.75rem] text-ink-soft">Reviews appear once we have read them.</p>
      </div>
    </form>
  )
}
