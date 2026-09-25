import type { Payload } from 'payload'

import type { SiteSetting } from '@/payload-types'

import { type Minor, toMinor } from './money'

/**
 * The cheapest and dearest delivery within Qatar and the cheapest abroad, for
 * copy such as "Delivery across Qatar from QAR 20". Used by the product page
 * and the homepage so they can never quote different figures.
 *
 * Priced exactly as the engine prices them (./shipping.ts): minor units, the
 * international surcharge applied to zones and rounded the same way.
 */
export type DeliveryRange = {
  intlLow: Minor | null
  qatarHigh: Minor | null
  qatarLow: Minor | null
}

export const deliveryRange = async (
  payload: Payload,
  settings: Pick<SiteSetting, 'intlSurchargePct'>,
): Promise<DeliveryRange> => {
  const [cities, zones] = await Promise.all([
    payload.find({
      collection: 'shippingCities',
      depth: 0,
      limit: 100,
      pagination: false,
      where: { active: { equals: true } },
    }),
    payload.find({
      collection: 'shippingZones',
      depth: 0,
      limit: 100,
      pagination: false,
      where: { active: { equals: true } },
    }),
  ])

  const qatar = cities.docs.map((city) => toMinor(city.feeQar))
  const surcharge = settings.intlSurchargePct ?? 0
  const intl = zones.docs.map((zone) => Math.round(toMinor(zone.feeQar) * (1 + surcharge / 100)))

  return {
    intlLow: intl.length ? Math.min(...intl) : null,
    qatarHigh: qatar.length ? Math.max(...qatar) : null,
    qatarLow: qatar.length ? Math.min(...qatar) : null,
  }
}
