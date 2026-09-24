import type { Payload } from 'payload'

import type { DiscountCode } from '@/payload-types'

import { getCachedGlobal } from '@/utilities/getGlobals'

import { isEmailEnabled, isUndeliverable, siteUrl } from './config'
import { button, esc, heading, label, layout, muted, paragraph } from './layout'
import { runAfterResponse } from './sendOrderEmail'

const dateFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', timeZone: 'Asia/Qatar', year: 'numeric' })

/** The prize in words, from the issued code itself (what the discount engine will honour). */
const rewardOf = (code: Pick<DiscountCode, 'type' | 'value'>) =>
  code.type === 'percent' ? `${code.value}% off` : code.type === 'fixed' ? `QAR ${code.value} off` : 'Free delivery'

/** The email that carries a won code — pure, so it can be tested. */
export const buildSpinRewardEmail = (args: {
  code: Pick<DiscountCode, 'code' | 'expiresAt' | 'type' | 'value'>
  shopUrl: string
}): { html: string; subject: string; text: string } => {
  const reward = rewardOf(args.code)
  const until = args.code.expiresAt ? dateFormat.format(new Date(args.code.expiresAt)) : null

  const html = layout({
    body: [
      label('For your first visit'),
      heading(`${reward}, yours`),
      paragraph('Thank you for joining the list. Here is your code — enter it at checkout.'),
      `<div style="border:1px solid rgba(27,24,21,0.16);padding:18px 20px;margin:8px 0 18px;text-align:center;font-family:'Jost','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:20px;letter-spacing:0.24em;color:#1b1815;">${esc(args.code.code)}</div>`,
      muted(`${until ? `Valid until ${esc(until)}. ` : ''}One use, for this email address only.`),
      button(args.shopUrl, 'Shop the collection'),
    ].join('\n'),
    footer: {},
    preheader: `${reward} — your code is ${args.code.code}.`,
  })

  const text = [
    `${reward}, yours.`,
    '',
    `Your code: ${args.code.code}`,
    `${until ? `Valid until ${until}. ` : ''}One use, for this email address only.`,
    '',
    args.shopUrl,
  ].join('\n')

  return { html, subject: `Your plumpose code: ${reward}`, text }
}

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
