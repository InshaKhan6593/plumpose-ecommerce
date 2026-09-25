import type { Metadata } from 'next'

import React from 'react'

import { getSessionUser } from '@/components/account/session'
import {
  CheckoutPage,
  type CheckoutCity,
  type CheckoutCountry,
  type CheckoutSavedAddress,
} from '@/components/checkout/CheckoutPage'
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
 *
 * A signed-in customer's most recent saved address is passed in to pre-fill
 * the form (their account's address book, /account/addresses).
 */
export default async function Checkout({
  searchParams,
}: {
  searchParams: Promise<{ payment?: string }>
}) {
  const { payload, user } = await getSessionUser()
  const { payment } = await searchParams

  const [countries, cities, addresses] = await Promise.all([
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
    user
      ? payload.find({
          collection: 'addresses',
          depth: 0,
          limit: 1,
          overrideAccess: false,
          pagination: false,
          sort: '-updatedAt',
          user,
          where: { customer: { equals: user.id } },
        })
      : null,
  ])

  // Qatar first — most orders are local — then everyone else alphabetically.
  const countryList: CheckoutCountry[] = countries.docs
    .map((c) => ({ blockedReason: c.blockedReason ?? null, code: c.code, name: c.name }))
    .sort((a, b) => Number(b.code === QATAR_COUNTRY_CODE) - Number(a.code === QATAR_COUNTRY_CODE))

  const cityList: CheckoutCity[] = cities.docs
    .filter((c) => c.key)
    .map((c) => ({ feeQar: c.feeQar, key: c.key as string, name: c.name }))

  // The saved address, in the form's shape. In Qatar the city is matched to its delivery key by name.
  const latest = addresses?.docs[0]
  const saved: CheckoutSavedAddress | undefined = latest
    ? {
        addressLine1: latest.addressLine1 ?? '',
        addressLine2: latest.addressLine2 ?? '',
        city: latest.city ?? '',
        cityKey:
          latest.country === QATAR_COUNTRY_CODE
            ? (cityList.find((c) => c.name === latest.city)?.key ?? '')
            : '',
        country: latest.country,
        firstName: latest.firstName ?? '',
        lastName: latest.lastName ?? '',
        phone: latest.phone ?? '',
        postalCode: latest.postalCode ?? '',
      }
    : undefined

  return (
    <CheckoutPage
      saved={saved}
      cancelled={payment === 'cancelled'}
      cities={cityList}
      countries={countryList}
      testMode={(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '').startsWith('pk_test_')}
    />
  )
}
