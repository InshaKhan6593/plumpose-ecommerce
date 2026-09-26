import type { ReactNode } from 'react'

import configPromise from '@payload-config'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'

type Args = {
  children: ReactNode
  params: Promise<{ slug: string }>
}

/**
 * Answers an unknown project with a real 404. The page streams under
 * `loading.tsx`, so its own `notFound()` came after a 200 had been sent; this
 * layout is outside that boundary and decides the status first. Published
 * projects only, as the page reads them (`overrideAccess: false`).
 */
export default async function ProjectLayout({ children, params }: Args) {
  const { slug } = await params
  const payload = await getPayload({ config: configPromise })

  const { docs } = await payload.find({
    collection: 'projects',
    depth: 0,
    limit: 1,
    overrideAccess: false,
    pagination: false,
    select: { slug: true },
    where: { slug: { equals: slug } },
  })

  if (!docs.length) notFound()

  return children
}
