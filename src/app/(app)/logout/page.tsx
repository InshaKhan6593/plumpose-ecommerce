import type { Metadata } from 'next'

import React from 'react'

import { AuthShell } from '@/components/account'
import { SignOut } from '@/components/account/AuthForms'
import { ButtonLink, TextLink } from '@/components/editorial'

export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: 'Signed out',
}

export default function LogoutPage() {
  return (
    <AuthShell
      footer={<TextLink href="/login">Sign in again</TextLink>}
      intro="You have been signed out."
      title="Until next time"
    >
      <SignOut />
      <div className="text-center">
        <ButtonLink href="/shop">Discover the collection</ButtonLink>
      </div>
    </AuthShell>
  )
}
