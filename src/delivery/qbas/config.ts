/**
 * QBAS Hub — the Doha courier the client uses — through its LogesTechs API.
 *
 * Everything comes from the environment: the login is a secret (the API has
 * no key of its own yet — every booking and cancellation sends the merchant
 * account's email and password), and the pickup address and phone are hers,
 * which a public repository must not carry.
 *
 * | Variable | |
 * |---|---|
 * | `QBAS_EMAIL`, `QBAS_PASSWORD` | Her QBAS merchant login (qbas.logestechs.com) |
 * | `QBAS_SENDER_PHONE`, `QBAS_SENDER_ADDRESS` | Where the driver collects: her profile's phone and address |
 * | `QBAS_SENDER_ZONE_ID` | Its zone, a QBAS city id (Al Gharrafa 51 is 570481) |
 * | `QBAS_WEBHOOK_SECRET` | Long random string, the key in the status webhook's address |
 * | `QBAS_SERVICE_TYPE_ID` | Default 281, "جاف" (Dry) — her account's service for ordinary parcels |
 * | `QBAS_VEHICLE_TYPE_ID` | Optional; sent when set. The only vehicle on Dry is "المبرد" |
 * | `QBAS_COMPANY_ID` | Default 553 — QBAS's own id inside LogesTechs |
 * | `QBAS_API_URL` | Default https://apisv2.logestechs.com/api |
 * | `QBAS_SENDER_NAME` | Default PLUMPOSE |
 */

export type QbasConfig = {
  apiUrl: string
  companyId: number
  email: string
  password: string
  sender: { address: string; name: string; phone: string; zoneId: number }
  serviceTypeId: number
  vehicleTypeId: null | number
  webhookSecret: string
}

const num = (value: string | undefined, fallback: null | number): null | number => {
  const n = Number(value)
  return value && Number.isInteger(n) && n > 0 ? n : fallback
}

export const qbasConfig = (): QbasConfig => ({
  apiUrl: (process.env.QBAS_API_URL || 'https://apisv2.logestechs.com/api').replace(/\/+$/, ''),
  companyId: num(process.env.QBAS_COMPANY_ID, 553) as number,
  email: process.env.QBAS_EMAIL?.trim() ?? '',
  password: process.env.QBAS_PASSWORD ?? '',
  sender: {
    address: process.env.QBAS_SENDER_ADDRESS?.trim() ?? '',
    name: process.env.QBAS_SENDER_NAME?.trim() || 'PLUMPOSE',
    phone: process.env.QBAS_SENDER_PHONE?.trim() ?? '',
    zoneId: num(process.env.QBAS_SENDER_ZONE_ID, 0) as number,
  },
  serviceTypeId: num(process.env.QBAS_SERVICE_TYPE_ID, 281) as number,
  vehicleTypeId: num(process.env.QBAS_VEHICLE_TYPE_ID, null),
  webhookSecret: process.env.QBAS_WEBHOOK_SECRET ?? '',
})

/** What is still missing before a booking can be sent — in her words, for the order screen. */
export const qbasMissing = (config: QbasConfig = qbasConfig()): string[] =>
  [
    !config.email || !config.password ? 'the QBAS login' : '',
    !config.sender.phone ? 'the pickup phone' : '',
    !config.sender.address ? 'the pickup address' : '',
    !config.sender.zoneId ? 'the pickup zone' : '',
  ].filter(Boolean)

export const isQbasEnabled = (): boolean => qbasMissing().length === 0
