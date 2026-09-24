'use client'

import type { Product } from '@/payload-types'

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

              let isAvailableForSale = true

              // Find a matching variant
              if (variants) {
                const matchingVariant = variants
                  .filter((variant) => typeof variant === 'object')
                  .find((variant) => {
                    if (!variant.options || !Array.isArray(variant.options)) return false

                    // Check if all variant options match the current options in the URL
                    return variant.options.every((variantOption) => {
                      if (typeof variantOption !== 'object')
                        return currentOptions.includes(String(variantOption))

                      return currentOptions.includes(String(variantOption.id))
                    })
                  })

                if (matchingVariant) {
                  // If we found a matching variant, set the variant ID in the search params.
                  optionSearchParams.set('variant', String(matchingVariant.id))

                  if (matchingVariant.inventory && matchingVariant.inventory > 0) {
                    isAvailableForSale = true
                  } else {
                    isAvailableForSale = false
                  }
                }
              }

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
                    'caps flex size-12 items-center justify-center border text-[0.6875rem] transition-colors duration-300 ease-brand',
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
                  title={`${option.label}${!isAvailableForSale ? ' — sold out' : ''}`}
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
