import type { Metadata } from 'next'

import configPromise from '@payload-config'
import { headers as getHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import React from 'react'
import Stripe from 'stripe'

import { PaymentPending } from '@/components/checkout/PaymentPending'
import { settleCheckoutSession } from '@/payments/checkoutSession'
import { isStripeSandboxEnabled } from '@/payments/stripeSandbox'
import { getCachedGlobal } from '@/utilities/getGlobals'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: 'Confirming your payment — plumpose',
}

/**
 * Where Stripe's hosted page sends the customer back.
 *
 * The order is settled here, on the server, before anything renders — the
 * same `settleCheckoutSession` the webhook calls, so whichever arrives first
 * creates it and the other finds it done. A paid session goes straight to its
 * order; an unpaid one back to checkout with the bag intact. The only thing
 * shown here is the rare moment where the payment is taken but not yet
 * confirmable, and that page keeps checking by itself.
 */
export default async function CheckoutReturn({ searchParams }: { searchParams: Promise<{ session_id?: string }> }) {
  const { session_id: sessionId } = await searchParams

  if (!sessionId || !/^cs_[A-Za-z0-9_]+$/.test(sessionId) || !isStripeSandboxEnabled()) {
    redirect('/checkout')
  }

  const payload = await getPayload({ config: configPromise })
  const headers = await getHeaders()

  const result = await settleCheckoutSession({
    /** So a signed-in customer's order settles as theirs. */
    cookie: headers.get('cookie'),
    payload,
    sessionId,
    stripe: new Stripe(process.env.STRIPE_SECRET_KEY || ''),
  })

  if (result.status === 'confirmed') {
    redirect(`/order/${result.orderId}?${new URLSearchParams({ placed: '1', token: result.accessToken })}`)
  }
  if (result.status === 'unpaid') {
    redirect('/checkout?payment=cancelled')
  }

  const settings = await getCachedGlobal('siteSettings', 0)()

  return (
    <PaymentPending
      contactEmail={settings.contactEmail ?? null}
      error={result.status === 'error' ? result.reason : null}
    />
  )
}
