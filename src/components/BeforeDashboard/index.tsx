import config from '@payload-config'
import { getPayload } from 'payload'
import React from 'react'

import { paymentOutcome } from '@/lib/payments/outcome'
import { RATES_STALE_DAYS } from '@/lib/pricing/rates'

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
  // The same "running low" figure the stock alerts use (Site settings → Stock alerts).
  const settings = await payload.findGlobal({ depth: 0, slug: 'siteSettings' }).catch(() => null)
  const lowAt = Math.max(0, settings?.lowStockThreshold ?? 2)
  const today = startOfToday()

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [
    ordersToday,
    awaiting,
    lowStock,
    pendingReviews,
    pendingSpotted,
    liveProducts,
    recentPayments,
    newEnquiries,
    latestRate,
  ] = await Promise.all([
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
      pagination: false,
      // A product populates with a few fields by default; these two decide what counts.
      populate: { products: { _status: true, madeToOrder: true } },
      where: { inventory: { less_than_equal: lowAt } },
    }),
    payload.count({ collection: 'reviews', where: { status: { equals: 'pending' } } }),
    payload.count({ collection: 'spotted', where: { status: { equals: 'pending' } } }),
    payload.count({ collection: 'products', where: { _status: { equals: 'published' } } }),
    // Checkouts in the last week that did not end in a payment (REQUIREMENTS P11).
    payload.find({
      collection: 'transactions',
      depth: 0,
      pagination: false,
      select: { createdAt: true, status: true },
      where: {
        and: [
          { createdAt: { greater_than_equal: weekAgo } },
          { status: { not_equals: 'succeeded' } },
        ],
      },
    }),
    payload.count({ collection: 'form-submissions', where: { status: { equals: 'new' } } }),
    // When exchange rates were last refreshed (REQUIREMENTS A14).
    payload.find({
      collection: 'currencies',
      depth: 0,
      limit: 1,
      select: { rateUpdatedAt: true },
      sort: '-rateUpdatedAt',
      where: { rateUpdatedAt: { exists: true } },
    }),
  ]).catch(() => [null, null, null, null, null, null, null, null, null] as any)

  const revenueToday =
    ordersToday?.docs?.reduce((sum: number, o: any) => sum + (o.amount || 0), 0) ?? 0

  const stats: Array<{ hint?: string; label: string; value: string }> = [
    { label: 'Orders today', value: String(ordersToday?.totalDocs ?? 0) },
    { label: 'Taken today', value: money(revenueToday) },
    {
      hint: 'Needs packing or posting',
      label: 'Awaiting fulfilment',
      value: String(awaiting?.totalDocs ?? 0),
    },
    { label: 'Live products', value: String(liveProducts?.totalDocs ?? 0) },
  ]

  /*
   * Only what needs her: sizes of live pieces that are sold out or running
   * low. A made-to-order size at zero is working as intended — it is made
   * when ordered — so it is not counted, as the stock emails also say.
   */
  const liveSizes = ((lowStock?.docs ?? []) as any[]).filter(
    (v) => typeof v.product === 'object' && v.product?._status === 'published',
  )
  const soldOut = liveSizes.filter(
    (v) => (v.inventory ?? 0) <= 0 && v.product.madeToOrder === false,
  ).length
  const runningLow = liveSizes.filter((v) => (v.inventory ?? 0) > 0).length
  const sizesLink = '/admin/collections/variants?sort=inventory'

  const notPaid = (
    (recentPayments?.docs ?? []) as Array<{ createdAt: string; status?: string }>
  ).filter((t) => !paymentOutcome({ createdAt: t.createdAt, status: t.status }).fine).length
  const paymentsLink = '/admin/collections/transactions?where[status][not_equals]=succeeded'

  const ratesAt = latestRate?.docs?.[0]?.rateUpdatedAt as string | undefined
  const ratesAgeDays = ratesAt
    ? Math.floor((Date.now() - new Date(ratesAt).getTime()) / 86_400_000)
    : null
  const ratesStale =
    latestRate !== null && (ratesAgeDays === null || ratesAgeDays > RATES_STALE_DAYS)

  const toReview = (pendingReviews?.totalDocs ?? 0) + (pendingSpotted?.totalDocs ?? 0)

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

      {(toReview > 0 ||
        soldOut > 0 ||
        runningLow > 0 ||
        notPaid > 0 ||
        (newEnquiries?.totalDocs ?? 0) > 0 ||
        ratesStale) && (
        <div className={`${baseClass}__alerts`}>
          {toReview > 0 && (
            <p>
              <strong>{toReview}</strong> {toReview === 1 ? 'submission is' : 'submissions are'}{' '}
              waiting for your approval.
            </p>
          )}
          {(newEnquiries?.totalDocs ?? 0) > 0 && (
            <p>
              <strong>{newEnquiries.totalDocs}</strong> new{' '}
              {newEnquiries.totalDocs === 1 ? 'enquiry' : 'enquiries'}.{' '}
              <a href="/admin/collections/form-submissions?where[status][equals]=new">
                Read {newEnquiries.totalDocs === 1 ? 'it' : 'them'}
              </a>
            </p>
          )}
          {notPaid > 0 && (
            <p>
              <strong>{notPaid}</strong> {notPaid === 1 ? 'checkout' : 'checkouts'} in the last week{' '}
              {notPaid === 1 ? 'was' : 'were'} not paid. <a href={paymentsLink}>See payments</a>
            </p>
          )}
          {ratesStale && (
            <p>
              Exchange rates{' '}
              {ratesAgeDays === null
                ? 'have not been fetched yet'
                : `were last refreshed ${ratesAgeDays} days ago`}
              . <a href="/admin/collections/currencies">Refresh them</a>
            </p>
          )}
          {soldOut > 0 && (
            <p>
              <strong>{soldOut}</strong> {soldOut === 1 ? 'size is' : 'sizes are'} sold out.{' '}
              <a href={sizesLink}>See sizes &amp; stock</a>
            </p>
          )}
          {runningLow > 0 && (
            <p>
              <strong>{runningLow}</strong> {runningLow === 1 ? 'size is' : 'sizes are'} down to{' '}
              {lowAt} or fewer. <a href={sizesLink}>See sizes &amp; stock</a>
            </p>
          )}
        </div>
      )}
    </div>
  )
}
