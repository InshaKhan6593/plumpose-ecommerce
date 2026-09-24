import type { PayloadRequest } from 'payload'

import { siteUrl } from './config'
import { button, heading, label, layout, muted, paragraph } from './layout'

/**
 * The "forgot password" email, in the brand rather than Payload's default.
 *
 * The link goes to the admin's reset screen, which works for any account.
 * Customers will want a storefront reset page instead; when the storefront
 * gets one, branch on the user's roles here.
 */

export const passwordResetSubject = (): string => 'Reset your plumpose password'

export const passwordResetHtml = (args?: { req?: PayloadRequest; token?: string }): string => {
  const adminRoute = args?.req?.payload.config.routes.admin ?? '/admin'
  const href = `${siteUrl()}${adminRoute}/reset/${args?.token ?? ''}`

  return layout({
    body: [
      label('Account'),
      heading('Reset your password'),
      paragraph('Someone — hopefully you — asked to reset the password for this account.'),
      button(href, 'Choose a new password'),
      muted('The link works for one hour. If you did not ask for this, ignore this email and nothing will change.'),
    ].join('\n'),
    footer: {},
    preheader: 'Choose a new password — the link works for one hour.',
  })
}
