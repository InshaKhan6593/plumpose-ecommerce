import type { Metadata } from 'next'

import Link from 'next/link'
import React from 'react'

import type { Order } from '@/payload-types'

import { Notice } from '@/components/account'
import { requireUser } from '@/components/account/session'
import { ButtonLink, TextLink } from '@/components/editorial'
import { formatQar } from '@/lib/pricing/money'

export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: 'Your orders',
}

const FULFILMENT: Record<NonNullable<Order['fulfilment']>, string> = {
  delivered: 'Delivered',
  inAtelier: 'In the atelier',
  shipped: 'On its way',
  unfulfilled: 'Order placed',
}

const dateFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

type Props = { searchParams: Promise<{ notice?: string }> }

/**
 * The account's front page is the customer's orders — the one thing people
 * come to an account for (docs/SCREEN-PROMPTS 17): one row each, newest first,
 * opening the same order page the confirmation email links to.
 *
 * Only orders placed while signed in are here. A guest order is found through
 * Track order, and the page says so rather than looking empty.
 */
export default async function AccountOrdersPage({ searchParams }: Props) {
  const { notice } = await searchParams
  const { payload, user } = await requireUser('/account')

  const { docs } = await payload.find({
    collection: 'orders',
    depth: 0,
    limit: 100,
    overrideAccess: false,
    pagination: false,
    select: { amount: true, createdAt: true, fulfilment: true, items: true },
    sort: '-createdAt',
    user,
    where: { customer: { equals: user.id } },
  })
  const orders = docs as Order[]

  return (
    <div className="flex flex-col gap-10">
      <Notice code={notice} />
      <h1 className="caps text-[0.6875rem]">Orders</h1>

      {orders.length ? (
        <ul className="border-t border-line">
          {orders.map((order) => {
            const pieces = (order.items ?? []).reduce((n, item) => n + (item.quantity ?? 0), 0)
            return (
              <li key={order.id}>
                <Link
                  className="group grid grid-cols-2 items-baseline gap-x-6 gap-y-2 border-b border-line py-7 md:grid-cols-[1fr_1.2fr_1fr_auto] md:py-8"
                  href={`/order/${order.id}`}
                >
                  <span>
                    <span className="caps block text-[0.625rem]">No. {order.id}</span>
                    <span className="mt-1 block text-[0.8125rem] text-ink-soft">{dateFormat.format(new Date(order.createdAt))}</span>
                  </span>
                  <span className="caps text-right text-[0.5625rem] text-ink-soft md:text-left">
                    {FULFILMENT[order.fulfilment ?? 'unfulfilled']}
                  </span>
                  <span className="text-[0.9375rem] tabular-nums md:text-right">
                    {formatQar(order.amount)}
                    <span className="ml-2 text-[0.8125rem] text-ink-soft">
                      · {pieces} {pieces === 1 ? 'piece' : 'pieces'}
                    </span>
                  </span>
                  <span className="caps text-right text-[0.5625rem] underline-offset-4 group-hover:underline">View</span>
                </Link>
              </li>
            )
          })}
        </ul>
      ) : (
        <div className="border border-line px-7 py-10">
          <p className="serif-display text-[2rem]">No orders yet</p>
          <p className="mt-3 max-w-md text-[0.9375rem] leading-relaxed text-ink-soft">
            When you order while signed in, it will be here — with its progress from the atelier to your door.
          </p>
          <ButtonLink className="mt-8" href="/shop">
            Discover the collection
          </ButtonLink>
        </div>
      )}

      <p className="text-[0.8125rem] leading-relaxed text-ink-soft">
        Ordered without signing in? <TextLink className="ml-1" href="/find-order">Find it with Track order</TextLink>
      </p>
    </div>
  )
}
