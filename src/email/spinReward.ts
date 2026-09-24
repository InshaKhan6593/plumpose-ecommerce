import type { Payload } from 'payload'

import type { DiscountCode } from '@/payload-types'

import { getCachedGlobal } from '@/utilities/getGlobals'

import { isEmailEnabled, isUndeliverable, siteUrl } from './config'
import { runAfterResponse } from './sendOrderEmail'
import { buildSpinRewardEmail } from './spinRewardEmail'

/**
 * Emails a won code once the spin has committed — re-reading the code on a
 * fresh connection, as every shop email does (./sendOrderEmail.ts). The code is
 * also shown on screen, so a failed send loses nothing.
 */
export const scheduleSpinRewardEmail = (payload: Payload, args: { codeId: number; email: string }) => {
  if (!isEmailEnabled() || isUndeliverable(args.email)) return

  runAfterResponse(payload, async () => {
    const code = (await payload
      .findByID({ collection: 'discountCodes', depth: 0, id: args.codeId, overrideAccess: true })
      .catch(() => null)) as DiscountCode | null
    if (!code) return

    const settings = await getCachedGlobal('siteSettings', 0)()
    const email = buildSpinRewardEmail({ code, shopUrl: `${siteUrl()}/shop` })
    try {
      await payload.sendEmail({ ...email, replyTo: settings.contactEmail || undefined, to: args.email })
      payload.logger.info({ code: code.id }, 'Wheel code emailed.')
    } catch (error) {
      payload.logger.error({ code: code.id, err: error }, 'Wheel code email failed.')
    }
  })
}
