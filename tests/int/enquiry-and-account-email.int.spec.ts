import { describe, expect, it } from 'vitest'

import { buildEnquiryAlert } from '@/email/enquiryAlert'
import { passwordResetHtml } from '@/email/passwordReset'

const labels = new Map([
  ['email', 'Email'],
  ['message', 'Message'],
  ['name', 'Name'],
  ['subject', 'About'],
])

describe('enquiry alert', () => {
  const email = buildEnquiryAlert({
    adminUrl: 'http://localhost:3000/admin/collections/form-submissions/7',
    labels,
    rows: [
      ['name', 'Mariam <b>K</b>'],
      ['email', 'mariam.k@gmail.com'],
      ['subject', 'Made for you'],
      ['message', 'First line\n<script>alert(1)</script>'],
    ],
  })

  it('escapes every submitted value — nothing a stranger types reaches the inbox as markup', () => {
    expect(email.html).not.toContain('<script>')
    expect(email.html).not.toContain('<b>K</b>')
    expect(email.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(email.html).toContain('Mariam &lt;b&gt;K&lt;/b&gt;')
  })

  it('keeps the message line breaks', () => {
    expect(email.html).toContain('First line<br>&lt;script&gt;')
  })

  it('names the topic and the person in the subject, and replies to them', () => {
    expect(email.subject).toBe('New enquiry: Made for you — Mariam <b>K</b>')
    expect(email.replyTo).toBe('mariam.k@gmail.com')
    expect(email.text).toContain('About: Made for you')
  })

  it('does not reply to an address that is not one, or to a test domain', () => {
    const bad = buildEnquiryAlert({ adminUrl: 'x', labels, rows: [['email', 'not-an-email'], ['message', 'hi']] })
    const test = buildEnquiryAlert({ adminUrl: 'x', labels, rows: [['email', 'a@plumpose.local'], ['message', 'hi']] })
    expect(bad.replyTo).toBeUndefined()
    expect(test.replyTo).toBeUndefined()
    expect(bad.subject).toBe('New enquiry: Someone')
  })
})

describe('password reset link', () => {
  const token = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678'

  it('sends a customer to the storefront reset page', () => {
    const html = passwordResetHtml({ token, user: { roles: ['customer'] } })
    expect(html).toContain(`/reset-password?token=${token}`)
    expect(html).not.toContain('/admin/reset/')
  })

  it('sends the client and her staff to the admin reset screen', () => {
    expect(passwordResetHtml({ token, user: { roles: ['admin'] } })).toContain(`/admin/reset/${token}`)
    expect(passwordResetHtml({ token, user: { roles: ['staff'] } })).toContain(`/admin/reset/${token}`)
  })

  it('treats an account with no roles as a customer', () => {
    expect(passwordResetHtml({ token, user: {} })).toContain('/reset-password?token=')
  })
})
