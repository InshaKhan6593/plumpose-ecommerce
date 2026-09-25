import type { CollectionAfterChangeHook, Payload } from 'payload'

import type { Form, FormSubmission } from '@/payload-types'

import { getCachedGlobal } from '@/utilities/getGlobals'

import { isEmailEnabled, isUndeliverable, siteUrl } from './config'
import { button, esc, heading, label, layout, muted, paragraph, row, rule, table } from './layout'
import { runAfterResponse } from './sendOrderEmail'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/**
 * "New enquiry" — the email the client gets when someone writes through the
 * Contact page, in the house style of the order alerts.
 *
 * Built here rather than with the form-builder plugin's own emails, which
 * write submitted values into the HTML unescaped: anything a stranger types
 * would reach her inbox as markup. Every value goes through `esc()`.
 *
 * Sent after the response, on a fresh read of the saved submission — the same
 * rule as the order emails (./sendOrderEmail.ts): a submission that did not
 * commit sends nothing. Goes to Site settings → "New-order alerts go to", or
 * the contact email; replying answers the person who wrote.
 */
export const sendEnquiryAlert: CollectionAfterChangeHook<FormSubmission> = ({
  doc,
  operation,
  req,
}) => {
  if (operation !== 'create' || !isEmailEnabled()) return doc
  const { payload } = req
  runAfterResponse(payload, () => deliver(payload, doc.id))
  return doc
}

async function deliver(payload: Payload, id: number) {
  const submission = (await payload
    .findByID({ collection: 'form-submissions', depth: 1, id, overrideAccess: true })
    .catch(() => null)) as FormSubmission | null
  if (!submission) return

  const settings = await getCachedGlobal('siteSettings', 0)()
  const to = settings.orderAlertEmail || settings.contactEmail
  if (!to || isUndeliverable(to)) return

  const form = typeof submission.form === 'object' ? (submission.form as Form) : null
  const labels = new Map(
    (form?.fields ?? [])
      .filter((f): f is typeof f & { name: string } => 'name' in f && typeof f.name === 'string')
      .map((f) => [f.name, ('label' in f && f.label) || f.name]),
  )
  const email = buildEnquiryAlert({
    adminUrl: `${siteUrl()}/admin/collections/form-submissions/${submission.id}`,
    labels,
    rows: (submission.submissionData ?? []).map((r) => [r.field, r.value] as [string, string]),
  })

  try {
    await payload.sendEmail({ ...email, to })
    payload.logger.info({ submission: id }, 'Enquiry alert sent.')
  } catch (error) {
    payload.logger.error({ err: error, submission: id }, 'Enquiry alert failed.')
  }
}

/**
 * The alert itself, from the submitted rows — pure, so it can be tested.
 * Every submitted value is escaped; the message keeps its line breaks.
 */
export function buildEnquiryAlert({
  adminUrl,
  labels,
  rows,
}: {
  adminUrl: string
  labels: Map<string, string>
  rows: Array<[string, string]>
}): { html: string; replyTo?: string; subject: string; text: string } {
  const values = new Map(rows)
  const from = values.get('email') ?? ''
  const replyTo = EMAIL.test(from) && !isUndeliverable(from) ? from : undefined
  const name = values.get('name') || 'Someone'
  const about = values.get('subject')
  const message = values.get('message') ?? ''
  const others = [...values].filter(([field]) => field !== 'message')

  const html = layout({
    body: [
      label('New enquiry'),
      heading(about ? `${name} — ${about}` : name),
      table(
        others.map(([field, value]) => row(esc(labels.get(field) ?? field), esc(value))).join(''),
      ),
      rule(),
      paragraph(esc(message).replace(/\n/g, '<br>')),
      rule(),
      replyTo
        ? muted('Reply to this email to answer them directly.')
        : muted('They left no email address to reply to.'),
      button(adminUrl, 'Open in the admin'),
    ].join('\n'),
    footer: {},
    preheader: message.slice(0, 120),
  })

  const text = [
    `New enquiry from ${name}${about ? ` — ${about}` : ''}`,
    ...others.map(([field, value]) => `${labels.get(field) ?? field}: ${value}`),
    '',
    message,
  ].join('\n')

  return {
    html,
    replyTo,
    subject: `New enquiry: ${about ? `${about} — ` : ''}${name}`.slice(0, 150),
    text,
  }
}
