import type { Metadata } from 'next'
import type { Where } from 'payload'

import configPromise from '@payload-config'
import { Check } from 'lucide-react'
import { headers as getHeaders } from 'next/headers'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import React from 'react'

import type { Media, Order, Product, Variant, VariantOption } from '@/payload-types'

import { ClearBag } from '@/components/checkout/ClearBag'
import { customerEmailOf } from '@/email/orderEmails'
import { formatQar } from '@/lib/pricing/money'
import { formatDateTime } from '@/utilities/formatDateTime'
import { getCachedGlobal } from '@/utilities/getGlobals'
import { cn } from '@/utilities/cn'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: 'Your order — plumpose',
}

/**
 * An order, for the person who placed it (docs/SCREEN-PROMPTS.md 10).
 *
 * Reached by the link on the confirmation email and the redirect after
 * payment: `/order/:id?token=…`. The token is the order's own random
 * `accessToken` — unguessable, where the old site's `?orderRef=` was not (L6,
 * P2) — and the customer's email is deliberately **not** in the address, so it
 * does not end up in browser history or server logs. A signed-in customer can
 * also open their own orders without it.
 *
 * `placed=1` is the arrival straight from payment: the thank-you headline, and
 * the browser forgets the bag that was just paid for.
 */

const STEPS: Array<{ key: NonNullable<Order['fulfilment']>; label: string }> = [
  { key: 'unfulfilled', label: 'Order placed' },
  { key: 'inAtelier', label: 'In the atelier' },
  { key: 'shipped', label: 'On its way' },
  { key: 'delivered', label: 'Delivered' },
]

type Personalisation = NonNullable<NonNullable<Order['items']>[number]['personalisation']>[number]

const describe = (p: Personalisation) =>
  `${p.placementName ?? p.placement}: ${[
    p.lettering ? `“${p.lettering}”` : '',
    p.symbolName ? p.symbolName.toLowerCase() : '',
    p.threadName ? `${p.threadName.toLowerCase()} thread` : '',
  ]
    .filter(Boolean)
    .join(', ')}`

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ placed?: string; token?: string }>
}) {
  const { id } = await params
  const { placed, token = '' } = await searchParams
  const orderId = Number(id)
  if (!Number.isInteger(orderId) || orderId <= 0) notFound()

  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: await getHeaders() })

  // Either the order's own token, or the signed-in customer it belongs to. Nothing else.
  const access: Where[] = []
  if (token && /^[0-9a-f-]{36}$/i.test(token)) access.push({ accessToken: { equals: token } })
  if (user) access.push({ customer: { equals: user.id } })
  if (!access.length) notFound()

  const found = await payload.find({
    collection: 'orders',
    depth: 2,
    limit: 1,
    overrideAccess: true,
    pagination: false,
    where: { and: [{ id: { equals: orderId } }, { or: access }] },
  })
  const order = found.docs[0] as Order | undefined
  if (!order) notFound()

  const settings = await getCachedGlobal('siteSettings', 0)()

  const address = order.shippingAddress
  // The address stores the ISO code; the customer reads the country's name.
  const countryName = address?.country
    ? ((
        await payload.find({
          collection: 'countries',
          depth: 0,
          limit: 1,
          pagination: false,
          select: { name: true },
          where: { code: { equals: address.country } },
        })
      ).docs[0]?.name ?? address.country)
    : ''
  const stepIndex = Math.max(0, STEPS.findIndex((s) => s.key === (order.fulfilment ?? 'unfulfilled')))
  const hasEmbroidery = (order.personalisationTotalQar ?? 0) > 0
  const justPlaced = placed === '1'
  const email = customerEmailOf(order)

  return (
    <div className="mx-auto max-w-3xl px-5 pt-14 pb-28 md:pt-20">
      {justPlaced ? <ClearBag /> : null}

      <header className="text-center">
        {justPlaced ? (
          <span aria-hidden className="mx-auto flex size-12 items-center justify-center rounded-full border border-ink">
            <Check className="size-5" strokeWidth={1.25} />
          </span>
        ) : null}
        <h1 className={cn('serif-display text-[clamp(2.5rem,5vw,3.75rem)] leading-[1.05]', justPlaced && 'mt-8')}>
          {justPlaced ? `Thank you${address?.firstName ? `, ${address.firstName}` : ''}.` : 'Your order'}
        </h1>
        {justPlaced ? (
          <p className="mx-auto mt-5 max-w-md leading-relaxed text-ink-soft">
            Your order is confirmed
            {email ? (
              <>
                {' '}— a receipt is on its way to <span className="text-ink">{email}</span>
              </>
            ) : null}
            .
          </p>
        ) : null}

        <div className="mx-auto mt-10 inline-flex flex-col items-center border border-line px-8 py-4">
          <span className="caps text-[0.5625rem] text-ink-soft">Order</span>
          <span className="caps mt-1.5 text-sm tracking-[0.18em] tabular-nums">No. {order.id}</span>
          <span className="mt-1.5 text-xs text-ink-soft">
            {formatDateTime({ date: order.createdAt, format: 'd MMMM yyyy' })}
          </span>
        </div>
      </header>

      {/* Where it is */}
      <section aria-label="Progress" className="mt-16">
        <ol className="grid grid-cols-4">
          {STEPS.map((step, i) => {
            const reached = i <= stepIndex
            return (
              <li className="relative flex flex-col items-center text-center" key={step.key}>
                {i > 0 ? (
                  <span
                    aria-hidden
                    className={cn('absolute top-[5px] right-1/2 h-px w-full', i <= stepIndex ? 'bg-ink' : 'bg-line')}
                  />
                ) : null}
                <span
                  aria-hidden
                  className={cn('relative size-[11px] rounded-full border', reached ? 'border-ink bg-ink' : 'border-ink-faint bg-background')}
                />
                <span className={cn('caps mt-3 text-[0.5625rem] leading-snug', reached ? 'text-ink' : 'text-ink-soft')}>
                  {step.label}
                  {i === stepIndex ? <span className="sr-only"> (current)</span> : null}
                </span>
              </li>
            )
          })}
        </ol>
        {order.trackingNumber ? (
          <p className="mt-8 text-center text-sm text-ink-soft">
            Tracking number <span className="caps text-ink tracking-[0.14em]">{order.trackingNumber}</span>
          </p>
        ) : hasEmbroidery && settings.personalisationLeadTime && stepIndex < 2 ? (
          <p className="mt-8 text-center text-sm text-ink-soft">
            Hand embroidery takes {settings.personalisationLeadTime} before your order ships.
          </p>
        ) : null}
      </section>

      {/* What is in it */}
      <section aria-label="Your pieces" className="mt-16 bg-paper-3 px-6 py-8 md:px-10">
        <ul>
          {(order.items ?? []).map((item, index) => {
            const product = typeof item.product === 'object' ? (item.product as Product) : null
            const variant = typeof item.variant === 'object' ? (item.variant as Variant) : null
            const size = variant?.options
              ?.map((o) => (typeof o === 'object' ? (o as VariantOption).label : null))
              .filter(Boolean)
              .join(' / ')
            const image = product?.gallery?.find((g) => typeof g.image === 'object')?.image as Media | undefined

            return (
              <li className="flex gap-5 border-b border-line py-5 first:pt-0" key={item.id ?? index}>
                <div className="relative aspect-[4/5] w-16 shrink-0 overflow-hidden bg-background">
                  {image?.url ? (
                    <Image alt={image.alt || product?.title || ''} className="object-cover" fill sizes="64px" src={image.url} />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="serif-display text-lg leading-snug">
                    {product ? product.title.split(/\s+[—–]\s+/)[0] : 'This piece is no longer listed'}
                  </p>
                  <p className="mt-1 text-xs text-ink-soft">
                    {size ? `Size ${size} · ` : ''}Qty {item.quantity}
                  </p>
                  {(item.personalisation ?? []).map((p, i) => (
                    <p className="serif-italic mt-1 text-[0.8125rem] text-ink-soft" key={p.id ?? i}>
                      Embroidery — {describe(p)}
                    </p>
                  ))}
                </div>
              </li>
            )
          })}
        </ul>

        <dl className="mt-6 flex flex-col gap-2.5 text-sm">
          {typeof order.subtotalQar === 'number' ? <Row label="Pieces" value={formatQar(order.subtotalQar)} /> : null}
          {hasEmbroidery ? <Row label="Embroidery" value={formatQar(order.personalisationTotalQar)} /> : null}
          {typeof order.shippingQar === 'number' ? (
            <Row
              label={order.shippingLabel || 'Delivery'}
              value={order.freeShippingApplied ? 'Free' : formatQar(order.shippingQar)}
            />
          ) : null}
          {order.discountTotalQar ? (
            <Row
              label={order.discountCode ? `Discount · ${order.discountCode}` : 'Discount'}
              value={`− ${formatQar(order.discountTotalQar)}`}
            />
          ) : null}
          <div className="mt-3 flex items-baseline justify-between border-t border-line pt-4">
            <dt className="caps text-[0.6875rem]">Total paid</dt>
            <dd className="text-lg tabular-nums">{formatQar(order.amount)}</dd>
          </div>
        </dl>
      </section>

      {/* Where it goes */}
      <section className="mt-12 grid gap-10 sm:grid-cols-2">
        {address ? (
          <div>
            <h2 className="caps text-[0.625rem] text-ink-soft">Delivering to</h2>
            <address className="mt-3 text-[0.9375rem] leading-relaxed not-italic">
              {[address.firstName, address.lastName].filter(Boolean).join(' ')}
              <br />
              {address.addressLine1}
              {address.addressLine2 ? (
                <>
                  <br />
                  {address.addressLine2}
                </>
              ) : null}
              <br />
              {[address.city, address.postalCode].filter(Boolean).join(' ')}
              {countryName ? `, ${countryName}` : ''}
            </address>
          </div>
        ) : null}
        <div>
          <h2 className="caps text-[0.625rem] text-ink-soft">Contact</h2>
          <p className="mt-3 text-[0.9375rem] leading-relaxed">
            {email}
            {address?.phone ? (
              <>
                <br />
                {address.phone}
              </>
            ) : null}
          </p>
        </div>
        {order.gift ? (
          <div className="sm:col-span-2">
            <h2 className="caps text-[0.625rem] text-ink-soft">A gift</h2>
            <p className="serif-italic mt-3 text-lg leading-relaxed">
              {order.giftNote ? `“${order.giftNote}”` : 'With a handwritten card, and no prices in the parcel.'}
            </p>
          </div>
        ) : null}
      </section>

      <footer className="mt-16 flex flex-col items-center gap-5 border-t border-line pt-10 text-center">
        <Link className="caps bg-ink px-10 py-4 text-[0.6875rem] text-white hover:bg-ink/85" href="/shop">
          Continue shopping
        </Link>
        {settings.contactEmail ? (
          <p className="text-sm text-ink-soft">
            Questions about your order?{' '}
            <a className="text-ink underline underline-offset-4" href={`mailto:${settings.contactEmail}`}>
              {settings.contactEmail}
            </a>
          </p>
        ) : null}
      </footer>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="caps text-[0.625rem] text-ink-soft">{label}</dt>
      <dd className="text-right tabular-nums">{value}</dd>
    </div>
  )
}
