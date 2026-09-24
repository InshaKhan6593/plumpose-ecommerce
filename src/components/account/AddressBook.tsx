'use client'

import { useRouter } from 'next/navigation'
import React, { useState } from 'react'
import { useForm } from 'react-hook-form'

import type { Address } from '@/payload-types'

import { HouseAlert, HouseButton, HouseField, houseInput } from '@/components/forms/house'
import { cn } from '@/utilities/cn'

export type BookCity = { key: string; name: string }
export type BookCountry = { code: string; name: string }

type Fields = {
  addressLine1: string
  addressLine2: string
  city: string
  country: string
  firstName: string
  lastName: string
  phone: string
  postalCode: string
}

const QATAR = 'QA'

/**
 * The customer's saved addresses (REQUIREMENTS S10). Laid out as checkout
 * lays out an address, so a saved one fills checkout exactly: in Qatar the
 * city is chosen from the delivery cities (it prices the delivery), anywhere
 * else it is typed. Checkout pre-fills from the most recent one.
 *
 * Reads are rendered on the server; every change goes to `/api/addresses`
 * (owner-only access, and the plugin sets `customer` to the signed-in user
 * whatever the browser sends) and then refreshes the page.
 */
export function AddressBook({
  addresses,
  cities,
  countries,
}: {
  addresses: Address[]
  cities: BookCity[]
  countries: BookCountry[]
}) {
  const router = useRouter()
  const [editing, setEditing] = useState<'new' | number | null>(addresses.length ? null : 'new')
  const [error, setError] = useState<null | string>(null)

  const countryName = (code?: null | string) => countries.find((c) => c.code === code)?.name ?? code ?? ''

  const remove = async (id: number) => {
    if (!window.confirm('Remove this address?')) return
    setError(null)
    const res = await fetch(`/api/addresses/${id}`, { credentials: 'include', method: 'DELETE' })
    if (!res.ok) setError('That didn’t work. Please try again.')
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-10">
      {error ? <HouseAlert>{error}</HouseAlert> : null}

      {addresses.length ? (
        <ul className="grid gap-6 md:grid-cols-2">
          {addresses.map((address) =>
            editing === address.id ? (
              <li className="md:col-span-2" key={address.id}>
                <AddressForm
                  cities={cities}
                  countries={countries}
                  initial={address}
                  onDone={() => setEditing(null)}
                />
              </li>
            ) : (
              <li className="flex flex-col justify-between gap-6 border border-line px-6 py-6" key={address.id}>
                <address className="text-[0.9375rem] leading-[1.7] not-italic">
                  <span className="block text-ink">{[address.firstName, address.lastName].filter(Boolean).join(' ')}</span>
                  <span className="block text-ink-soft">{address.addressLine1}</span>
                  {address.addressLine2 ? <span className="block text-ink-soft">{address.addressLine2}</span> : null}
                  <span className="block text-ink-soft">{[address.city, address.postalCode].filter(Boolean).join(' ')}</span>
                  <span className="block text-ink-soft">{countryName(address.country)}</span>
                  {address.phone ? <span className="mt-2 block text-ink-soft tabular-nums">{address.phone}</span> : null}
                </address>
                <div className="flex gap-6">
                  <button className="caps text-[0.5625rem] underline-offset-4 hover:underline" onClick={() => setEditing(address.id)} type="button">
                    Edit
                  </button>
                  <button className="caps text-[0.5625rem] text-ink-soft underline-offset-4 hover:text-ink hover:underline" onClick={() => remove(address.id)} type="button">
                    Remove
                  </button>
                </div>
              </li>
            ),
          )}
        </ul>
      ) : null}

      {editing === 'new' ? (
        <AddressForm cities={cities} countries={countries} onDone={() => setEditing(null)} showCancel={addresses.length > 0} />
      ) : editing === null ? (
        <HouseButton className="self-start" onClick={() => setEditing('new')} type="button" variant="outline">
          Add an address
        </HouseButton>
      ) : null}
    </div>
  )
}

function AddressForm({
  cities,
  countries,
  initial,
  onDone,
  showCancel = true,
}: {
  cities: BookCity[]
  countries: BookCountry[]
  initial?: Address
  onDone: () => void
  showCancel?: boolean
}) {
  const router = useRouter()
  const [error, setError] = useState<null | string>(null)
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    watch,
  } = useForm<Fields>({
    defaultValues: {
      addressLine1: initial?.addressLine1 ?? '',
      addressLine2: initial?.addressLine2 ?? '',
      city: initial?.city ?? '',
      country: initial?.country ?? QATAR,
      firstName: initial?.firstName ?? '',
      lastName: initial?.lastName ?? '',
      phone: initial?.phone ?? '',
      postalCode: initial?.postalCode ?? '',
    },
  })
  const inQatar = watch('country') === QATAR

  const onSubmit = handleSubmit(async (data) => {
    setError(null)
    const body = Object.fromEntries(
      Object.entries({ ...data, postalCode: inQatar ? '' : data.postalCode }).map(([k, v]) => [k, v.trim()]),
    )
    const res = await fetch(initial ? `/api/addresses/${initial.id}` : '/api/addresses', {
      body: JSON.stringify(body),
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      method: initial ? 'PATCH' : 'POST',
    })
    if (!res.ok) {
      setError('That didn’t save. Please try again.')
      return
    }
    onDone()
    router.refresh()
  })

  const required = (label: string) => ({ required: `Please enter ${label}.` })

  return (
    <form className="grid gap-8 border border-line px-6 py-8 sm:grid-cols-2" noValidate onSubmit={onSubmit}>
      <h3 className="caps text-[0.625rem] sm:col-span-2">{initial ? 'Edit address' : 'New address'}</h3>
      <HouseField error={errors.firstName?.message} id="a-first" label="First name">
        <input aria-invalid={Boolean(errors.firstName)} autoComplete="given-name" className={houseInput} id="a-first" {...register('firstName', required('a first name'))} />
      </HouseField>
      <HouseField error={errors.lastName?.message} id="a-last" label="Last name">
        <input aria-invalid={Boolean(errors.lastName)} autoComplete="family-name" className={houseInput} id="a-last" {...register('lastName', required('a last name'))} />
      </HouseField>
      <HouseField className="sm:col-span-2" id="a-country" label="Country">
        <select className={cn(houseInput, 'cursor-pointer')} id="a-country" {...register('country')}>
          {countries.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>
      </HouseField>
      {inQatar ? (
        <HouseField className="sm:col-span-2" error={errors.city?.message} id="a-city" label="City">
          <select aria-invalid={Boolean(errors.city)} className={cn(houseInput, 'cursor-pointer')} id="a-city" {...register('city', {
              // A city typed for another country is not one of Qatar's delivery cities.
              validate: (v) => cities.some((c) => c.name === v) || 'Please choose a city.',
            })}>
            <option value="">Choose your city</option>
            {cities.map((c) => (
              <option key={c.key} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </HouseField>
      ) : null}
      <HouseField className="sm:col-span-2" error={errors.addressLine1?.message} id="a-line1" label="Street and building">
        <input aria-invalid={Boolean(errors.addressLine1)} autoComplete="address-line1" className={houseInput} id="a-line1" {...register('addressLine1', required('a street and building'))} />
      </HouseField>
      <HouseField className="sm:col-span-2" id="a-line2" label={inQatar ? 'Zone, apartment (optional)' : 'Apartment, area (optional)'}>
        <input autoComplete="address-line2" className={houseInput} id="a-line2" {...register('addressLine2')} />
      </HouseField>
      {!inQatar ? (
        <>
          <HouseField error={errors.city?.message} id="a-town" label="City">
            <input aria-invalid={Boolean(errors.city)} autoComplete="address-level2" className={houseInput} id="a-town" {...register('city', required('a city'))} />
          </HouseField>
          <HouseField id="a-post" label="Postcode (if any)">
            <input autoComplete="postal-code" className={houseInput} id="a-post" {...register('postalCode')} />
          </HouseField>
        </>
      ) : null}
      <HouseField className="sm:col-span-2" id="a-phone" label="Phone">
        <input autoComplete="tel" className={houseInput} id="a-phone" inputMode="tel" type="tel" {...register('phone')} />
      </HouseField>

      {error ? (
        <div className="sm:col-span-2">
          <HouseAlert>{error}</HouseAlert>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-6 sm:col-span-2">
        <HouseButton disabled={isSubmitting}>{isSubmitting ? 'Saving…' : 'Save address'}</HouseButton>
        {showCancel ? (
          <button className="caps text-[0.5625rem] text-ink-soft underline-offset-4 hover:text-ink hover:underline" onClick={onDone} type="button">
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  )
}
