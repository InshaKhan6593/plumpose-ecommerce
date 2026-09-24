'use client'

import type { EmbroideryChoice } from '@/components/product/embroidery'
import type { Product, Variant } from '@/payload-types'

import { useCart } from '@payloadcms/plugin-ecommerce/client/react'
import clsx from 'clsx'
import { useSearchParams } from 'next/navigation'
import React, { useCallback, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { openBag } from './CartModal'
type Props = {
  /** Called once the piece is in the bag — the product page clears its embroidery. */
  onAdded?: () => void
  /** Embroidery for this piece, as option keys. The server re-prices it; see @/components/product/embroidery. */
  personalisation?: EmbroideryChoice[]
  product: Product
}

export function AddToCart({ onAdded, personalisation = [], product }: Props) {
  const { addItem, cart, isLoading } = useCart()
  const [adding, setAdding] = useState(false)
  const searchParams = useSearchParams()

  const variants = product.variants?.docs || []

  const selectedVariant = useMemo<Variant | undefined>(() => {
    if (product.enableVariants && variants.length) {
      const variantId = searchParams.get('variant')

      const validVariant = variants.find((variant) => {
        if (typeof variant === 'object') {
          return String(variant.id) === variantId
        }
        return String(variant) === variantId
      })

      if (validVariant && typeof validVariant === 'object') {
        return validVariant
      }
    }

    return undefined
  }, [product.enableVariants, searchParams, variants])

  const addToCart = useCallback(
    (e: React.FormEvent<HTMLButtonElement>) => {
      e.preventDefault()

      setAdding(true)
      addItem({
        product: product.id,
        variant: selectedVariant?.id ?? undefined,
        ...(personalisation.length ? { personalisation } : {}),
      } as Parameters<typeof addItem>[0])
        .then(() => {
          onAdded?.()
          // Slide the bag open — the add-to-bag feedback (MOTION-SPEC D4).
          openBag()
        })
        .catch(() => {
          toast.error('That didn’t work. Please try again.')
        })
        .finally(() => setAdding(false))
    },
    [addItem, onAdded, personalisation, product, selectedVariant],
  )

  const disabled = useMemo<boolean>(() => {
    const existingItem = cart?.items?.find((item) => {
      const productID = typeof item.product === 'object' ? item.product?.id : item.product
      const variantID = item.variant
        ? typeof item.variant === 'object'
          ? item.variant?.id
          : item.variant
        : undefined

      if (productID === product.id) {
        if (product.enableVariants) {
          return variantID === selectedVariant?.id
        }
        return true
      }
    })

    if (existingItem) {
      const existingQuantity = existingItem.quantity

      if (product.enableVariants) {
        return existingQuantity >= (selectedVariant?.inventory || 0)
      }
      return existingQuantity >= (product.inventory || 0)
    }

    if (product.enableVariants) {
      if (!selectedVariant) {
        return true
      }

      if (selectedVariant.inventory === 0) {
        return true
      }
    } else {
      if (product.inventory === 0) {
        return true
      }
    }

    return false
  }, [selectedVariant, cart?.items, product])

  /** Say why the button is off, rather than leaving a dead button. */
  const needsSize = Boolean(product.enableVariants && !selectedVariant)
  const label = needsSize ? 'Select a size' : disabled ? 'Sold out' : 'Add to bag'

  return (
    <button
      className={clsx(
        'caps h-12 w-full px-8 text-[0.6875rem] transition-colors duration-300 ease-brand',
        disabled || isLoading
          ? 'cursor-not-allowed bg-ink/80 text-white/80'
          : 'bg-ink text-white hover:bg-ink/85',
      )}
      disabled={disabled || isLoading || adding}
      onClick={addToCart}
      type="submit"
    >
      {adding ? 'Adding…' : label}
    </button>
  )
}
