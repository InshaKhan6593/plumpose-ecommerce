import type { PayloadRequest } from 'payload'

import { siteUrl } from './config'
import { button, heading, label, layout, muted, paragraph } from './layout'

/**
 * The "forgot password" email, in the brand rather than Payload's default.
 *
 * Customers are sent to the storefront's own page (/reset-password), in the
 * brand; the client and her staff to the admin's reset screen, where they
 * work. Both take the same single-use Payload token.
 */

export const passwordResetSubject = (): string => 'Reset your plumpose password'

export const passwordResetHtml = (args?: {
  req?: PayloadRequest
  token?: string
  user?: { roles?: null | string[] }
}): string => {
  const token = encodeURIComponent(args?.token ?? '')
  const staff = args?.user?.roles?.some((role) => role === 'admin' || role === 'staff')
  const adminRoute = args?.req?.payload.config.routes.admin ?? '/admin'
  const href = staff ? `${siteUrl()}${adminRoute}/reset/${token}` : `${siteUrl()}/reset-password?token=${token}`

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
