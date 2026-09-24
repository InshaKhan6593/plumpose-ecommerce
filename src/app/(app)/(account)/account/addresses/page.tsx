import type { Metadata } from 'next'

import React from 'react'

import type { Address } from '@/payload-types'

import { AddressBook } from '@/components/account/AddressBook'
import { requireUser } from '@/components/account/session'
import { COUNTRY_OPTIONS } from '@/data/countryOptions'
import { QATAR_COUNTRY_CODE } from '@/lib/pricing/shipping'

export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: 'Your addresses',
}

export default async function AccountAddressesPage() {
  const { payload, user } = await requireUser('/account/addresses')

  const [addresses, cities] = await Promise.all([
    payload.find({
      collection: 'addresses',
      depth: 0,
      limit: 50,
      overrideAccess: false,
      pagination: false,
      sort: '-updatedAt',
      user,
      where: { customer: { equals: user.id } },
    }),
    payload.find({
      collection: 'shippingCities',
      depth: 0,
      limit: 100,
      pagination: false,
      select: { key: true, name: true },
      sort: '_order',
      where: { active: { not_equals: false } },
    }),
  ])

  // Qatar first — most customers are local — as at checkout.
  const countries = [...COUNTRY_OPTIONS]
    .sort((a, b) => Number(b.value === QATAR_COUNTRY_CODE) - Number(a.value === QATAR_COUNTRY_CODE))
    .map((c) => ({ code: c.value, name: c.label }))

  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="caps text-[0.6875rem]">Addresses</h1>
        <p className="mt-3 max-w-md text-[0.8125rem] leading-relaxed text-ink-soft">
          Your most recent address fills in at checkout, so you only type it once.
        </p>
      </div>
      <AddressBook
        addresses={addresses.docs as Address[]}
        cities={cities.docs.filter((c) => c.key).map((c) => ({ key: c.key as string, name: c.name }))}
        countries={countries}
      />
    </div>
  )
}
