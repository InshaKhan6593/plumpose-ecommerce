/**
 * Money units.
 *
 * ⚠️ **This project stores money in two different units, and mixing them is a
 * real money bug.** Read this before touching any total.
 *
 * | Field                                  | Stored   | Means      |
 * |----------------------------------------|----------|------------|
 * | `products.priceInQAR` (plugin)         | `139900` | QAR 1399.00 — **minor** |
 * | `variants.priceInQAR` (plugin)         | `139900` | QAR 1399.00 — **minor** |
 * | `orders.amount` (plugin)               | `139900` | QAR 1399.00 — **minor** |
 * | `shippingCities.feeQar`                | `20`     | QAR 20 — **major** |
 * | `shippingZones.feeQar`                 | `120`    | QAR 120 — **major** |
 * | `siteSettings.personalisationFeeQar`   | `160`    | QAR 160 — **major** |
 * | `siteSettings.freeShippingThresholdQar`| `1500`   | QAR 1500 — **major** |
 * | `discountCodes.value` / `minSpendQar`  | `100`    | QAR 100 — **major** |
 *
 * The split is not an accident and is not worth migrating away. The plugin
 * owns the product price and settles against it, so that one has to stay in
 * minor units. Everything the client edits by hand is in major units because
 * she should type `20` to mean twenty riyals, not `2000` — and the seeded
 * values, ported from the legacy `shipping.mjs`, are already in that form.
 *
 * The rule: **the pricing engine works in minor units throughout.** Every
 * major-unit field is converted with `toMinor()` at the moment it is read, and
 * nothing converts back except for display. Naively adding `139900 + 20 + 160`
 * gives QAR 1,400.80 for a basket that should come to QAR 1,579.
 */

/** Minor units — what every figure inside the pricing engine is. */
export type Minor = number

/** QAR has two decimal places, like most currencies the store quotes. */
export const MINOR_UNITS_PER_MAJOR = 100

/** A client-edited major-unit figure (QAR 20) to engine units (2000). */
export const toMinor = (major: null | number | undefined): Minor =>
  Math.round((major ?? 0) * MINOR_UNITS_PER_MAJOR)

/** Engine units back to major, for display only. */
export const toMajor = (minor: Minor): number => minor / MINOR_UNITS_PER_MAJOR

/**
 * A percentage of a minor-unit figure, rounded to the nearest minor unit.
 *
 * Rounds half away from zero so a 10% discount on QAR 1,399.05 takes 139.91
 * rather than 139.90 — the customer is never charged more because of a
 * rounding convention.
 */
export const percentOf = (amount: Minor, pct: number): Minor => Math.round((amount * pct) / 100)

/** Totals must never go below zero, whatever a discount claims to be worth. */
export const clampToZero = (amount: Minor): Minor => (amount < 0 ? 0 : amount)

/** `139900` → `QAR 1,399.00`. Display only — the same format as the admin's PriceCell. */
export const formatQar = (amount: Minor | null | undefined): string =>
  `QAR ${toMajor(amount ?? 0).toLocaleString('en-GB', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })}`
