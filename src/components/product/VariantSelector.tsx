'use client'

import type { Product } from '@/payload-types'

import { purchaseLimit, readyStock } from '@/lib/pricing/stock'
import { createUrl } from '@/utilities/createUrl'
import clsx from 'clsx'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import React from 'react'

export function VariantSelector({ product }: { product: Product }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const variants = product.variants?.docs
  const variantTypes = product.variantTypes
  const hasVariants = Boolean(product.enableVariants && variants?.length && variantTypes?.length)

  if (!hasVariants) {
    return null
  }

  return variantTypes?.map((type) => {
    if (!type || typeof type !== 'object') {
      return <></>
    }

    const options = type.options?.docs

    if (!options || !Array.isArray(options) || !options.length) {
      return <></>
    }

    return (
      <dl key={type.id}>
        <dt className="caps mb-3 text-[0.625rem] text-ink">{type.label}</dt>
        <dd className="flex flex-wrap gap-2.5">
          <React.Fragment>
            {options?.map((option) => {
              if (!option || typeof option !== 'object') {
                return <></>
              }

              const optionID = option.id
              const optionKeyLowerCase = type.name

              // Base option params on current params so we can preserve any other param state in the url.
              const optionSearchParams = new URLSearchParams(searchParams.toString())

              // Remove image and variant ID from this search params so we can loop over it safely.
              optionSearchParams.delete('variant')
              optionSearchParams.delete('image')

              // Update the option params using the current option to reflect how the url *would* change,
              // if the option was clicked.
              optionSearchParams.set(optionKeyLowerCase, String(optionID))

              const currentOptions = Array.from(optionSearchParams.values())

              /*
               * What this choice would select: this option, plus whatever is
               * already chosen for the other kinds (size, colour, pattern).
               * Available if some piece that exists has all of them and can be
               * ordered — so a colour that is only made in S and M is off once
               * L is chosen (REQUIREMENTS S4). With every kind chosen there is
               * exactly one piece, and its id goes in the URL for the bag.
               */
              const chosen = (variantTypes ?? [])
                .filter((t): t is Exclude<typeof t, number> => typeof t === 'object' && t !== null)
                .map((t) => optionSearchParams.get(t.name))
                .filter((id): id is string => Boolean(id))
              const optionIdsOf = (variant: Exclude<NonNullable<typeof variants>[number], number>) =>
                (variant.options ?? []).map((o) => String(typeof o === 'object' ? o.id : o))
              const candidates = (variants ?? [])
                .filter((v): v is Exclude<typeof v, number> => typeof v === 'object')
                .filter((v) => chosen.every((id) => optionIdsOf(v).includes(id)))
              const purchasable = candidates.filter((v) => purchaseLimit(product, v) > 0)

              const isAvailableForSale = purchasable.length > 0
              const allChosen = chosen.length === (variantTypes?.length ?? 0)
              const exact = allChosen && candidates.length === 1 ? candidates[0] : undefined
              if (exact) optionSearchParams.set('variant', String(exact.id))
              const madeToOrderOnly = Boolean(exact) && isAvailableForSale && readyStock(exact!) === 0
              const unavailableReason = !candidates.length ? 'not made in this combination' : 'sold out'

              const optionUrl = createUrl(pathname, optionSearchParams)

              // The option is active if it's in the url params.
              const isActive =
                Boolean(isAvailableForSale) &&
                searchParams.get(optionKeyLowerCase) === String(optionID)

              return (
                <button
                  aria-disabled={!isAvailableForSale}
                  aria-pressed={isActive}
                  className={clsx(
                    // Wide enough for a colour's name, still a square for S, M, L.
                    'caps flex h-12 min-w-12 items-center justify-center border px-3 text-[0.6875rem] whitespace-nowrap transition-colors duration-300 ease-brand',
                    isActive
                      ? 'border-ink bg-ink text-white'
                      : 'border-line text-ink hover:border-ink',
                    !isAvailableForSale && 'cursor-not-allowed text-ink-faint line-through hover:border-line',
                  )}
                  disabled={!isAvailableForSale}
                  key={option.id}
                  onClick={() => {
                    router.replace(`${optionUrl}`, {
                      scroll: false,
                    })
                  }}
                  title={`${option.label}${!isAvailableForSale ? ` — ${unavailableReason}` : madeToOrderOnly ? ' — made to order' : ''}`}
                  type="button"
                >
                  {option.label}
                </button>
              )
            })}
          </React.Fragment>
        </dd>
      </dl>
    )
  })
}
