import type { Product, Variant } from '@/payload-types'

/**
 * Whether a basket can be sold from stock — checked on the server, before
 * payment, by `priceOrder()` (so by the quote and by every payment adapter).
 *
 * The ecommerce plugin was meant to do this at payment and never did for a
 * product with sizes: in `endpoints/initiatePayment.js` the variant check is
 * nested inside `if (item.product && !item.variant)`, so it cannot run. Every
 * purchase decremented stock unchecked, and size M reached −115 in testing.
 *
 * The rule is the product's own "Made to order" switch (admin → Fabric & Care):
 *
 *   - **off** — stock is a hard limit. A size with none left cannot be bought,
 *     and no one can buy more than there are.
 *   - **on** — the stock figure is what is ready to send. A size can be
 *     ordered beyond it; those pieces are made to order (the storefront says
 *     so, and the order notes it for the atelier — see ./stockAfterSale.ts).
 *
 * Quantities are summed per size across the basket, so two lines of the same
 * size (one plain, one embroidered) cannot each pass on their own.
 */

export type StockLine = { product: Product; quantity: number; variant?: null | Variant }

/** What is available to sell: stock never counts below zero, whatever the database says. */
export const readyStock = (record: { inventory?: null | number }): number => Math.max(0, record.inventory ?? 0)

/**
 * The most of one size a customer may have in their bag — the storefront's
 * version of the same rule, so the button, the stepper and the server agree.
 * Unlimited when the product is made to order.
 */
export const purchaseLimit = (product: Pick<Product, 'madeToOrder'>, record: { inventory?: null | number }): number =>
  product.madeToOrder === false ? readyStock(record) : Number.POSITIVE_INFINITY

/** A size asked for beyond its ready stock. */
export type StockShortage = {
  available: number
  label: string
  /** The product's switch: true means the extra pieces are made to order, not refused. */
  madeToOrder: boolean
  productId: number
  requested: number
  variantId?: number
}

/** Every size in the basket asked for beyond its ready stock, made to order or not. */
export const stockShortages = (lines: StockLine[]): StockShortage[] => {
  const wanted = new Map<string, StockShortage>()

  for (const line of lines) {
    const key = line.variant ? `v${line.variant.id}` : `p${line.product.id}`
    const quantity = Math.max(1, Math.floor(line.quantity || 1))
    const current = wanted.get(key)

    if (current) current.requested += quantity
    else
      wanted.set(key, {
        available: readyStock(line.variant ?? line.product),
        label: sizeLabel(line.product, line.variant),
        madeToOrder: line.product.madeToOrder !== false,
        productId: line.product.id,
        requested: quantity,
        variantId: line.variant?.id,
      })
  }

  return [...wanted.values()].filter((w) => w.requested > w.available)
}

/**
 * The first reason a basket cannot be sold, in words for the customer — or
 * null when it can. Only products with "Made to order" off ever refuse.
 */
export const stockRefusal = (lines: StockLine[]): null | string => {
  const first = stockShortages(lines).find((s) => !s.madeToOrder)
  if (!first) return null
  if (first.available === 0) return `${first.label} is sold out. Please remove it from your bag or choose another size.`
  return `Only ${first.available} left in ${first.label}. Please lower the quantity in your bag.`
}

/**
 * What the bag and checkout tell the customer about stock: the refusal, if
 * the basket cannot be sold, and which sizes will be (partly) made to order.
 */
export type StockSummary = {
  madeToOrder: Array<{ count: number; label: string; variantId?: number }>
  refusal: null | string
}

export const stockSummary = (lines: StockLine[]): StockSummary => ({
  madeToOrder: stockShortages(lines)
    .filter((s) => s.madeToOrder)
    .map((s) => ({ count: s.requested - s.available, label: s.label, variantId: s.variantId })),
  refusal: stockRefusal(lines),
})

/** "Al Shaheen Nights, size M" — the size is the variant title's last part. */
const sizeLabel = (product: Product, variant?: null | Variant): string => {
  const name = product.title.split(' — ')[0]
  const size = variant?.title?.split(' — ').pop()
  return size && size !== product.title ? `${name}, size ${size}` : name
}
