import type { Metadata } from 'next'

import configPromise from '@payload-config'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import React from 'react'

import { PaymentPending } from '@/components/checkout/PaymentPending'
import { isSkipcashEnabled } from '@/payments/skipcash/api'
import { isPaymentId } from '@/payments/skipcash/protocol'
import { settleSkipcashPayment } from '@/payments/skipcash/settle'
import { getCachedGlobal } from '@/utilities/getGlobals'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: 'Confirming your payment — plumpose',
}

/**
 * Where SkipCash's payment page sends the customer back, as
 * `/checkout/return?id=<SkipCash payment id>&…`.
 *
 * Only the id is read, and only as a question to put to SkipCash: the status
 * SkipCash also puts in the address is the browser's word, and is ignored.
 * The order is settled here, on the server, before anything renders — the
 * same `settleSkipcashPayment` the webhook calls, so whichever arrives first
 * creates it and the other finds it done. A paid payment goes straight to its
 * order; an unpaid or refused one back to checkout with the bag intact. The
 * only thing shown here is the moment where SkipCash is still authorising,
 * and that page keeps checking by itself.
 */
export default async function CheckoutReturn({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>
}) {
  const { id: paymentId } = await searchParams

  if (!isPaymentId(paymentId) || !isSkipcashEnabled()) {
    redirect('/checkout')
  }

  const payload = await getPayload({ config: configPromise })
  const result = await settleSkipcashPayment({ payload, paymentId })

  if (result.status === 'confirmed') {
    redirect(
      `/order/${result.orderId}?${new URLSearchParams({ placed: '1', token: result.accessToken })}`,
    )
  }
  if (result.status === 'unpaid') redirect('/checkout?payment=cancelled')
  if (result.status === 'failed') redirect('/checkout?payment=failed')

  const settings = await getCachedGlobal('siteSettings', 0)()

  return (
    <PaymentPending
      contactEmail={settings.contactEmail ?? null}
      error={result.status === 'error' ? result.reason : null}
    />
  )
}
