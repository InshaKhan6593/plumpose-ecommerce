'use client'

import { useRouter } from 'next/navigation'
import React, { useEffect, useState } from 'react'

/** How long to keep checking before saying so. The webhook usually lands in a second or two. */
const TRIES = 12
const EVERY_MS = 2500

/**
 * Shown only in the gap between Stripe taking the payment and the order being
 * confirmable. It re-runs the return page every few seconds — which settles the
 * payment again — and the page redirects to the order the moment it exists.
 */
export function PaymentPending({ contactEmail, error }: { contactEmail: null | string; error: null | string }) {
  const router = useRouter()
  const [tries, setTries] = useState(0)

  useEffect(() => {
    if (error || tries >= TRIES) return
    const id = window.setTimeout(() => {
      setTries((n) => n + 1)
      router.refresh()
    }, EVERY_MS)
    return () => window.clearTimeout(id)
  }, [error, router, tries])

  const slow = tries >= TRIES

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-6 py-24 text-center" role="status">
      {error || slow ? (
        <>
          <h1 className="serif-display text-[clamp(2rem,4vw,3rem)] leading-tight">
            {error ? 'We could not find that payment.' : 'This is taking longer than usual.'}
          </h1>
          <p className="mt-5 leading-relaxed text-ink-soft">
            {error
              ? 'If you were charged, your order is safe and we will be in touch.'
              : 'Your payment was received. Your order confirmation will arrive by email shortly — there is no need to pay again.'}
          </p>
          {contactEmail ? (
            <p className="mt-6 text-sm text-ink-soft">
              Questions?{' '}
              <a className="text-ink underline underline-offset-4" href={`mailto:${contactEmail}`}>
                {contactEmail}
              </a>
            </p>
          ) : null}
        </>
      ) : (
        <>
          <span aria-hidden className="block size-8 animate-spin rounded-full border border-line border-t-ink" />
          <h1 className="serif-display mt-8 text-[clamp(2rem,4vw,3rem)] leading-tight">Confirming your payment…</h1>
          <p className="mt-4 text-ink-soft">One moment — please keep this page open.</p>
        </>
      )}
    </div>
  )
}
