import type { DiscountCode } from '@/payload-types'

import { button, esc, heading, label, layout, muted, paragraph } from './layout'

/*
 * The wheel's code email, as pure functions — kept apart from the sending in
 * ./spinReward.ts, which loads the Payload config, so it can be tested alone.
 */

const dateFormat = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  timeZone: 'Asia/Qatar',
  year: 'numeric',
})

/** The prize in words, from the issued code itself (what the discount engine will honour). */
const rewardOf = (code: Pick<DiscountCode, 'type' | 'value'>) =>
  code.type === 'percent'
    ? `${code.value}% off`
    : code.type === 'fixed'
      ? `QAR ${code.value} off`
      : 'Free delivery'

/** The email that carries a won code. */
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
