import type { Metadata } from 'next'

import React from 'react'

import { AuthShell } from '@/components/account'
import { ResetPasswordForm } from '@/components/account/AuthForms'
import { TextLink } from '@/components/editorial'

export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: 'Choose a new password',
}

type Props = { searchParams: Promise<{ token?: string }> }

/**
 * Where the "reset your password" email sends a customer (src/email/passwordReset.ts).
 * The token is Payload's own single-use reset token; it is checked when the
 * new password is submitted, not here, so an expired link still shows the
 * form and then says plainly that it has expired.
 */
export default async function ResetPasswordPage({ searchParams }: Props) {
  const { token } = await searchParams
  const valid = typeof token === 'string' && /^[a-f0-9]{20,}$/i.test(token)

  return (
    <AuthShell
      footer={<TextLink href="/login">Back to sign in</TextLink>}
      title="Choose a new password"
    >
      {valid ? (
        <ResetPasswordForm token={token} />
      ) : (
        <p className="text-center text-[0.9375rem] leading-relaxed text-ink-soft">
          This link is incomplete. Please open it again from your email, or{' '}
          <TextLink href="/forgot-password">ask for a new one</TextLink>.
        </p>
      )}
    </AuthShell>
  )
}
