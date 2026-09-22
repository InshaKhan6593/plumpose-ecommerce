import type { Country, ShippingCity, ShippingZone, SiteSetting } from '@/payload-types'

import { type Minor, toMinor } from './money'

/**
 * Delivery pricing.
 *
 * Ported from the legacy `netlify/lib/shipping.mjs`, whose opening comment is
 * the rule worth keeping:
 *
 *   > This file is the ONLY place delivery prices are set. The checkout panel
 *   > reads them from here, and the server charges from here, so a price can
 *   > never drift between what the customer is shown and what the card is
 *   > charged.
 *
 * That still holds — the table simply moved into the `shippingZones` and
 * `shippingCities` collections so the client can change a fee herself (A12).
 * The displayed quote and the charged amount must both come through
 * `deliveryFor()`; nothing should price an address any other way.
 *
 * Two additions the legacy file did not have: the free-shipping threshold
 * (C11/P8) and the blocked-country check moved in from `countries.mjs`.
 *
 * Fees are stored in **major** units (`20` is QAR 20) because that is what the
 * client types into the admin. Everything returned from here is **minor** —
 * see `./money.ts`.
 */

export const QATAR_ZONE_KEY = 'qatar'
export const QATAR_COUNTRY_CODE = 'QA'

export type Destination = {
  /** ISO-2, e.g. `QA`. */
  countryCode: string
  /** Qatar only: which city was chosen. Ignored elsewhere. */
  cityKey?: null | string
}

export type DeliveryQuote = {
  cityName: string
  /** Minor units. */
  feeQar: Minor
  label: string
  zoneKey: string
}

/** Why an address cannot be delivered to — distinct cases, distinct copy. */
export type DeliveryRefusal = {
  /** True when the country is deliberately closed, as opposed to unknown. */
  blocked: boolean
  message: string
  reason: 'blockedCountry' | 'unknownCity' | 'unknownCountry' | 'unknownZone'
}

export type DeliveryResult =
  { ok: false; refusal: DeliveryRefusal } | { ok: true; quote: DeliveryQuote }

export type ShippingTables = {
  cities: ShippingCity[]
  countries: Country[]
  zones: ShippingZone[]
}

const contactLine = 'Please email info@plumpose.com and we will do what we can.'

/**
 * Prices delivery to a destination.
 *
 * Qatar is priced per city because a courier run across Doha is not the same
 * job as one to Ras Laffan; everywhere else is priced per zone, with the
 * international surcharge applied on top. The surcharge exists so that when
 * fuel moves — DHL went to *weekly* surcharge updates in April 2026 — the
 * client raises one number instead of re-pricing ten zones.
 */
export const deliveryFor = (
  destination: Destination,
  tables: ShippingTables,
  settings: Partial<SiteSetting>,
): DeliveryResult => {
  const code = String(destination.countryCode ?? '')
    .trim()
    .toUpperCase()

  const country = tables.countries.find((c) => c.code === code)

  if (!country) {
    return {
      ok: false,
      refusal: {
        blocked: false,
        message: `We could not work out delivery to that country. ${contactLine}`,
        reason: 'unknownCountry',
      },
    }
  }

  /**
   * Blocked countries are sanctions and carrier suspensions (C23). The
   * client's own reason is shown back, because "we cannot deliver here" with
   * no explanation reads as a fault rather than a restriction.
   */
  if (country.blockedReason) {
    return {
      ok: false,
      refusal: {
        blocked: true,
        message: `We are very sorry — we cannot deliver to ${country.name} at present. ${country.blockedReason}. ${contactLine}`,
        reason: 'blockedCountry',
      },
    }
  }

  if (country.zoneKey === QATAR_ZONE_KEY) {
    const cityKey = String(destination.cityKey ?? '')
      .trim()
      .toLowerCase()
    const city = tables.cities.find((c) => c.key === cityKey && c.active !== false)

    if (!city) {
      return {
        ok: false,
        refusal: {
          blocked: false,
          message: 'Please choose a delivery city.',
          reason: 'unknownCity',
        },
      }
    }

    return {
      ok: true,
      quote: {
        cityName: city.name,
        feeQar: toMinor(city.feeQar),
        label: `Delivery to ${city.name}`,
        zoneKey: QATAR_ZONE_KEY,
      },
    }
  }

  const zone = tables.zones.find((z) => z.key === country.zoneKey && z.active !== false)

  if (!zone) {
    return {
      ok: false,
      refusal: {
        blocked: false,
        message: `We could not work out delivery to ${country.name}. ${contactLine}`,
        reason: 'unknownZone',
      },
    }
  }

  const surchargePct = settings.intlSurchargePct ?? 0
  const feeQar = Math.round(toMinor(zone.feeQar) * (1 + surchargePct / 100))

  return {
    ok: true,
    quote: {
      cityName: '',
      feeQar,
      label: `Delivery · ${zone.name}`,
      zoneKey: zone.key ?? country.zoneKey,
    },
  }
}

/**
 * Whether the basket has earned free delivery (C11, P8).
 *
 * Measured on the **goods subtotal plus embroidery**, not on the total — a
 * threshold that counted the delivery fee toward itself would let a remote
 * address qualify while a Doha one did not, for the same basket.
 *
 * Applied server-side here, and read by the storefront for the displayed
 * quote, so the two cannot disagree.
 */
export const qualifiesForFreeShipping = (
  goodsTotalMinor: Minor,
  settings: Partial<SiteSetting>,
): boolean => {
  if (!settings.freeShippingEnabled) return false

  const threshold = settings.freeShippingThresholdQar
  if (typeof threshold !== 'number' || threshold <= 0) return false

  return goodsTotalMinor >= toMinor(threshold)
}

/** The whole rate card, for the checkout panel to price against. */
export const rateCard = (tables: ShippingTables, settings: Partial<SiteSetting>) => {
  const surchargePct = settings.intlSurchargePct ?? 0

  return {
    currency: 'QAR',
    freeShippingThresholdQar: settings.freeShippingEnabled
      ? toMinor(settings.freeShippingThresholdQar)
      : null,
    qatarCities: tables.cities
      .filter((c) => c.active !== false)
      .map((c) => ({ name: c.name, feeQar: toMinor(c.feeQar), key: c.key })),
    zones: tables.zones
      .filter((z) => z.active !== false)
      .map((z) => ({
        name: z.name,
        feeQar: Math.round(toMinor(z.feeQar) * (1 + surchargePct / 100)),
        key: z.key,
      })),
  }
}
