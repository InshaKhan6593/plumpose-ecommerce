import type { Metadata } from 'next'

import configPromise from '@payload-config'
import { getPayload } from 'payload'
import React from 'react'

import { CheckoutPage, type CheckoutCity, type CheckoutCountry } from '@/components/checkout/CheckoutPage'
import { QATAR_COUNTRY_CODE } from '@/lib/pricing/shipping'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: 'Checkout — plumpose',
}

/**
 * Checkout (docs/SCREEN-PROMPTS.md 09). The page loads the destination tables
 * the form needs — every country, including the blocked ones so a customer is
 * told why rather than failing at payment, and the Qatar delivery cities —
 * and the form does the rest. Prices always come from `/api/quote`.
 */
export default async function Checkout({ searchParams }: { searchParams: Promise<{ payment?: string }> }) {
  const payload = await getPayload({ config: configPromise })
  const { payment } = await searchParams

  const [countries, cities] = await Promise.all([
    payload.find({
      collection: 'countries',
      depth: 0,
      limit: 500,
      pagination: false,
      select: { blockedReason: true, code: true, name: true },
      sort: 'name',
    }),
    payload.find({
      collection: 'shippingCities',
      depth: 0,
      limit: 100,
      pagination: false,
      select: { feeQar: true, key: true, name: true },
      sort: '_order',
      where: { active: { not_equals: false } },
    }),
  ])

  // Qatar first — most orders are local — then everyone else alphabetically.
  const countryList: CheckoutCountry[] = countries.docs
    .map((c) => ({ blockedReason: c.blockedReason ?? null, code: c.code, name: c.name }))
    .sort((a, b) => Number(b.code === QATAR_COUNTRY_CODE) - Number(a.code === QATAR_COUNTRY_CODE))

  const cityList: CheckoutCity[] = cities.docs
    .filter((c) => c.key)
    .map((c) => ({ feeQar: c.feeQar, key: c.key as string, name: c.name }))

  return (
    <CheckoutPage
      cancelled={payment === 'cancelled'}
      cities={cityList}
      countries={countryList}
      testMode={(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '').startsWith('pk_test_')}
    />
  )
}
