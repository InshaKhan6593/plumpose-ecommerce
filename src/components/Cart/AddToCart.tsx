'use client'

import type { EmbroideryChoice } from '@/components/product/embroidery'
import type { Product, Variant } from '@/payload-types'

import { useCart } from '@payloadcms/plugin-ecommerce/client/react'
import clsx from 'clsx'
import { useSearchParams } from 'next/navigation'
import React, { useCallback, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { purchaseLimit, readyStock } from '@/lib/pricing/stock'

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

  /*
   * One rule for the button, the bag's stepper and the server (@/lib/pricing/stock):
   * made to order → any quantity; otherwise no more than there are.
   */
  const record = product.enableVariants ? selectedVariant : product
  const inBag = useMemo(() => {
    const line = cart?.items?.find((item) => {
      const productID = typeof item.product === 'object' ? item.product?.id : item.product
      const variantID = item.variant ? (typeof item.variant === 'object' ? item.variant?.id : item.variant) : undefined
      return productID === product.id && (!product.enableVariants || variantID === selectedVariant?.id)
    })
    return line?.quantity ?? 0
  }, [cart?.items, product.enableVariants, product.id, selectedVariant?.id])

  /** Every size gone and none made to order: nothing to choose, so the button says so rather than "Select a size". */
  const everySizeSoldOut =
    Boolean(product.enableVariants && variants.length) &&
    variants.every((v) => typeof v === 'object' && purchaseLimit(product, v) === 0)
  const needsSize = Boolean(product.enableVariants && !selectedVariant) && !everySizeSoldOut
  const limit = record ? purchaseLimit(product, record) : 0
  const soldOut = everySizeSoldOut || (Boolean(record) && limit === 0)
  const atLimit = Boolean(record) && !soldOut && inBag >= limit
  const disabled = needsSize || soldOut || atLimit
  /** The next one added would be beyond what is ready to send. */
  const madeToOrder = Boolean(record) && product.madeToOrder !== false && readyStock(record!) <= inBag

  /** What is still to choose, by name: "Select a size", "Select a colour", "Select a size and colour". */
  const missing = (product.variantTypes ?? [])
    .filter((t): t is Exclude<typeof t, number> => typeof t === 'object' && t !== null)
    .filter((t) => !searchParams.get(t.name))
    .map((t) => (t.label || t.name).toLowerCase())

  /** Say why the button is off, rather than leaving a dead button. */
  const label = needsSize
    ? `Select a ${missing.length ? missing.join(' and ') : 'size'}`
    : soldOut
      ? 'Sold out'
      : atLimit
        ? `All ${limit} are in your bag`
        : 'Add to bag'

  return (
    <>
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
      {madeToOrder && !disabled ? (
        <p className="mt-3 text-[0.8125rem] leading-relaxed text-ink-soft">
          This one is made to order for you, so it takes a little longer to reach you.
        </p>
      ) : null}
    </>
  )
}
