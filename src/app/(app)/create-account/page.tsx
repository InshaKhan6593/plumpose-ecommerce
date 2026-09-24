import type { Metadata } from 'next'

import React from 'react'

import { AuthShell } from '@/components/account'
import { CreateAccountForm } from '@/components/account/AuthForms'
import { redirectIfSignedIn } from '@/components/account/session'
import { TextLink } from '@/components/editorial'

export const metadata: Metadata = {
  description: 'Create a plumpose account to keep your orders and addresses in one place.',
  robots: { follow: false, index: false },
  title: 'Create an account',
}

type Props = { searchParams: Promise<{ redirect?: string }> }

export default async function CreateAccountPage({ searchParams }: Props) {
  const { redirect } = await searchParams
  await redirectIfSignedIn()
  const query = redirect ? `?redirect=${encodeURIComponent(redirect)}` : ''

  return (
    <AuthShell
      footer={<TextLink href={`/login${query}`}>I already have an account</TextLink>}
      intro="Keep your orders and addresses in one place."
      title="Create an account"
    >
      <CreateAccountForm redirect={redirect} />
    </AuthShell>
  )
}
