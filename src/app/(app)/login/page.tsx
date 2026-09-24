import type { Metadata } from 'next'

import React from 'react'

import { AuthShell } from '@/components/account'
import { SignInForm } from '@/components/account/AuthForms'
import { redirectIfSignedIn } from '@/components/account/session'
import { TextLink } from '@/components/editorial'

export const metadata: Metadata = {
  description: 'Sign in to see your orders and saved addresses.',
  robots: { follow: false, index: false },
  title: 'Sign in',
}

type Props = { searchParams: Promise<{ notice?: string; redirect?: string }> }

export default async function LoginPage({ searchParams }: Props) {
  const { notice, redirect } = await searchParams
  await redirectIfSignedIn()
  const query = redirect ? `?redirect=${encodeURIComponent(redirect)}` : ''

  return (
    <AuthShell
      footer={
        <>
          <TextLink href={`/create-account${query}`}>Create an account</TextLink>
          <TextLink href="/find-order">Track an order</TextLink>
        </>
      }
      intro="Your orders and addresses, in one place."
      notice={notice}
      title="Sign in"
    >
      <SignInForm redirect={redirect} />
    </AuthShell>
  )
}
