import type { Metadata } from 'next'

import configPromise from '@payload-config'
import { headers as getHeaders } from 'next/headers.js'
import { getPayload } from 'payload'
import React from 'react'

import { PageHeading, TextLink } from '@/components/editorial'
import { FindOrderForm } from '@/components/forms/FindOrderForm'
import { getPageText } from '@/content/getPageText'
import { mergeOpenGraph } from '@/utilities/mergeOpenGraph'

/**
 * Track order (docs/SCREEN-PROMPTS 16). The lookup is unchanged from the
 * template — email + order number, answered with a private link by email and
 * the same reply whether or not an order matched, so the form cannot be used
 * to find out who has ordered. The order page behind that link shows the
 * four-step progress and the tracking number.
 */
export default async function FindOrderPage() {
  const { TRACK_PAGE } = await getPageText()
  const headers = await getHeaders()
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers })

  return (
    <div className="mx-auto max-w-xl px-4 pt-14 md:pt-20">
      <PageHeading intro={TRACK_PAGE.intro} title={TRACK_PAGE.heading} />
      <div className="mt-14">
        <FindOrderForm initialEmail={user?.email} sent={TRACK_PAGE.sent} />
      </div>
      <div className="mt-16 flex flex-wrap justify-center gap-8 border-t border-line pt-8">
        {user ? <TextLink href="/orders">Your orders</TextLink> : <TextLink href="/login">Sign in</TextLink>}
        <TextLink href="/shipping-returns#delivery">Delivery times</TextLink>
        <TextLink href="/contact?subject=An+order">Ask us</TextLink>
      </div>
    </div>
  )
}

export const metadata: Metadata = {
  description: 'Follow your plumpose order with your email and order number.',
  openGraph: mergeOpenGraph({
    title: 'Track your order',
    url: '/find-order',
  }),
  title: 'Track your order',
}
