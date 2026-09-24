/**
 * The plugin's `CartItemMatcher` type is not exported from its public entry.
 * A matcher that accepts anything is assignable to it.
 */
type CartItemMatcher = (args: { existingItem: unknown; newItem: unknown }) => boolean

/**
 * When is a new bag line "the same" as one already there?
 *
 * The plugin's default says: same product and same size — and then adds the
 * quantities together. For plumpose that loses embroidery. A plain M already in
 * the bag plus an M with "M.K" in gold would become "2 × plain M", and the
 * customer would be charged for, and receive, the wrong thing.
 *
 * So embroidery is part of a line's identity: two lines merge only when the
 * product, the size and every embroidered placement match exactly. The same
 * piece with different embroidery is two lines — which is also what the
 * pricing engine and the order snapshot already assume.
 */

type Embroidery = {
  lettering?: null | string
  placement?: null | string
  style?: null | string
  symbol?: null | string
  thread?: null | string
}

const idOf = (value: unknown): unknown =>
  value && typeof value === 'object' && 'id' in value ? (value as { id: unknown }).id : value

/** A stable signature for a line's embroidery, independent of placement order. */
export const embroiderySignature = (personalisation: unknown): string => {
  if (!Array.isArray(personalisation) || !personalisation.length) return ''

  return (personalisation as Embroidery[])
    .map((p) =>
      [p.placement, p.style, p.lettering, p.symbol, p.thread].map((v) => String(v ?? '').trim()).join('|'),
    )
    .sort()
    .join(';')
}

export const plumposeCartItemMatcher: CartItemMatcher = ({ existingItem, newItem }) => {
  const existing = existingItem as Record<string, unknown>
  const incoming = newItem as Record<string, unknown>

  return (
    idOf(existing.product) === idOf(incoming.product) &&
    (idOf(existing.variant) ?? null) === (idOf(incoming.variant) ?? null) &&
    embroiderySignature(existing.personalisation) === embroiderySignature(incoming.personalisation)
  )
}
