import type { ReactNode } from 'react'

import configPromise from '@payload-config'
import { draftMode } from 'next/headers'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'

type Args = {
  children: ReactNode
  params: Promise<{ slug: string }>
}

/**
 * Answers an unknown product with a real 404. The page sits under
 * `loading.tsx`, so it streams: by the time its own `notFound()` ran, a 200
 * had already been sent and search engines indexed every mistyped address as
 * a page. This layout is outside that boundary, so it decides the status
 * before anything is sent. A light lookup — the page does the full one.
 */
export default async function ProductLayout({ children, params }: Args) {
  const { slug } = await params
  const { isEnabled: draft } = await draftMode()
  const payload = await getPayload({ config: configPromise })

  const { docs } = await payload.find({
    collection: 'products',
    depth: 0,
    draft,
    limit: 1,
    overrideAccess: draft,
    pagination: false,
    select: { slug: true },
    where: {
      and: [{ slug: { equals: slug } }, ...(draft ? [] : [{ _status: { equals: 'published' } }])],
    },
  })

  if (!docs.length) notFound()

  return children
}
