import type { Metadata } from 'next'

import React from 'react'

import { Notice } from '@/components/account'
import { DetailsForm } from '@/components/account/DetailsForm'
import { requireUser } from '@/components/account/session'

export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: 'Your details',
}

type Props = { searchParams: Promise<{ notice?: string }> }

export default async function AccountDetailsPage({ searchParams }: Props) {
  const { notice } = await searchParams
  const { user } = await requireUser('/account/details')

  return (
    <div className="flex flex-col gap-10">
      <Notice code={notice} />
      <h1 className="caps text-[0.6875rem]">Your details</h1>
      <DetailsForm user={{ email: user.email, id: user.id, name: user.name }} />
    </div>
  )
}
