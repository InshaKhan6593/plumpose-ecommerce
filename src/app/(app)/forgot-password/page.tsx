import type { Metadata } from 'next'

import React from 'react'

import { AuthShell } from '@/components/account'
import { ForgotPasswordForm } from '@/components/account/AuthForms'
import { TextLink } from '@/components/editorial'

export const metadata: Metadata = {
  description: 'Choose a new password for your plumpose account.',
  robots: { follow: false, index: false },
  title: 'Forgotten password',
}

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      footer={<TextLink href="/login">Back to sign in</TextLink>}
      intro="Enter your email and we will send you a link to choose a new password."
      title="Forgotten password"
    >
      <ForgotPasswordForm />
    </AuthShell>
  )
}
