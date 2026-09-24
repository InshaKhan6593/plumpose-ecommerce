import { ShoppingBag } from 'lucide-react'
import React from 'react'

/**
 * The bag icon in the header. Rendered as the cart drawer's trigger, so it
 * accepts whatever props and ref the drawer passes down.
 */
export function OpenCartButton({
  quantity,
  ...rest
}: {
  quantity?: number
} & React.ComponentProps<'button'>) {
  return (
    <button
      aria-label={quantity ? `Bag, ${quantity} ${quantity === 1 ? 'item' : 'items'}` : 'Bag'}
      className="relative flex items-center hover:cursor-pointer"
      type="button"
      {...rest}
    >
      <ShoppingBag className="size-[1.15rem]" strokeWidth={1.25} />
      {quantity ? (
        <span className="absolute -top-1.5 -right-2.5 text-[0.625rem] leading-none tabular-nums">
          {quantity}
        </span>
      ) : null}
    </button>
  )
}
