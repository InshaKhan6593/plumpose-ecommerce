import config from '@payload-config'
import { getPayload } from 'payload'
import React from 'react'

import './index.scss'

const baseClass = 'plumpose-dashboard'

const startOfToday = () => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

const money = (minorUnits: number) =>
  `QAR ${(minorUnits / 100).toLocaleString('en-GB', {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  })}`

/**
 * The client's landing screen. Replaces the template's demo banner, which
 * offered a one-click "seed demo data" button — one accidental press and her
 * live store fills with sample products.
 *
 * A React Server Component, so it can read through the Local API directly.
 */
export const BeforeDashboard: React.FC = async () => {
  const payload = await getPayload({ config })
  const today = startOfToday()

  const [ordersToday, awaiting, lowStock, pendingReviews, pendingSpotted, liveProducts] =
    await Promise.all([
      payload.find({
        collection: 'orders',
        depth: 0,
        limit: 100,
        where: { createdAt: { greater_than_equal: today } },
      }),
      payload.count({
        collection: 'orders',
        where: { fulfilment: { in: ['unfulfilled', 'inAtelier'] } },
      }),
      payload.find({
        collection: 'variants',
        depth: 1,
        limit: 10,
        where: { inventory: { less_than_equal: 2 } },
      }),
      payload.count({ collection: 'reviews', where: { status: { equals: 'pending' } } }),
      payload.count({ collection: 'spotted', where: { status: { equals: 'pending' } } }),
      payload.count({ collection: 'products', where: { _status: { equals: 'published' } } }),
    ]).catch(() => [null, null, null, null, null, null] as any)

  const revenueToday =
    ordersToday?.docs?.reduce((sum: number, o: any) => sum + (o.amount || 0), 0) ?? 0

  const stats: Array<{ hint?: string; label: string; value: string }> = [
    { label: 'Orders today', value: String(ordersToday?.totalDocs ?? 0) },
    { label: 'Taken today', value: money(revenueToday) },
    { hint: 'Needs packing or posting', label: 'Awaiting fulfilment', value: String(awaiting?.totalDocs ?? 0) },
    { label: 'Live products', value: String(liveProducts?.totalDocs ?? 0) },
  ]

  const toReview =
    (pendingReviews?.totalDocs ?? 0) + (pendingSpotted?.totalDocs ?? 0)

  return (
    <div className={baseClass}>
      <div className={`${baseClass}__head`}>
        <h2>Good day.</h2>
        <p>Here is where plumpose stands right now.</p>
      </div>

      <div className={`${baseClass}__stats`}>
        {stats.map((s) => (
          <div className={`${baseClass}__stat`} key={s.label}>
            <span className={`${baseClass}__stat-value`}>{s.value}</span>
            <span className={`${baseClass}__stat-label`}>{s.label}</span>
            {s.hint && <span className={`${baseClass}__stat-hint`}>{s.hint}</span>}
          </div>
        ))}
      </div>

      {(toReview > 0 || (lowStock?.totalDocs ?? 0) > 0) && (
        <div className={`${baseClass}__alerts`}>
          {toReview > 0 && (
            <p>
              <strong>{toReview}</strong>{' '}
              {toReview === 1 ? 'submission is' : 'submissions are'} waiting for your approval.
            </p>
          )}
          {(lowStock?.totalDocs ?? 0) > 0 && (
            <p>
              <strong>{lowStock?.totalDocs}</strong>{' '}
              {lowStock?.totalDocs === 1 ? 'size is' : 'sizes are'} down to the last two pieces.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
