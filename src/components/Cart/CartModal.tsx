'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { useCart } from '@payloadcms/plugin-ecommerce/client/react'
import { X } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React, { useEffect, useMemo, useState } from 'react'

import type { Media, Product, Variant, VariantOption } from '@/payload-types'

import { formatQar } from '@/lib/pricing/money'
import { useLenis } from '@/motion/MotionProvider'
import { cn } from '@/utilities/cn'

import { OpenCartButton } from './OpenCart'

/** Dispatch this to slide the bag open — AddToCart does, once a piece is in. */
export const OPEN_BAG_EVENT = 'plumpose:open-bag'
export const openBag = () => window.dispatchEvent(new Event(OPEN_BAG_EVENT))

type QuoteLine = {
  personalisation: Array<{
    lettering: string
    placementName: string
    symbolName: string
    threadName: string
  }>
  personalisationTotal: number
  subtotal: number
}

type Quote = {
  lines: QuoteLine[]
  totals: { personalisation: number; subtotal: number; total: number }
}

const describe = (p: QuoteLine['personalisation'][number]) =>
  `${p.placementName}: ${[
    p.lettering ? `“${p.lettering}”` : '',
    p.symbolName ? p.symbolName.toLowerCase() : '',
    p.threadName ? `${p.threadName.toLowerCase()} thread` : '',
  ]
    .filter(Boolean)
    .join(', ')}`

/**
 * The bag (SCREEN-PROMPTS 08).
 *
 * The plugin keeps the lines; **the money comes from `/api/quote`** — the same
 * engine checkout charges through — because the cart's own `subtotal` is goods
 * only (no embroidery) and is overwritten with the full total once payment
 * starts. Delivery is left to checkout, where the address is known.
 */
export function CartModal() {
  const { cart, decrementItem, incrementItem, isLoading, removeItem } = useCart()
  const [isOpen, setIsOpen] = useState(false)
  const [quote, setQuote] = useState<null | Quote>(null)
  const pathname = usePathname()
  const lenis = useLenis()

  const items = useMemo(() => cart?.items ?? [], [cart])
  const count = items.reduce((n, item) => n + (item.quantity || 0), 0)

  useEffect(() => setIsOpen(false), [pathname])

  useEffect(() => {
    const open = () => setIsOpen(true)
    window.addEventListener(OPEN_BAG_EVENT, open)
    return () => window.removeEventListener(OPEN_BAG_EVENT, open)
  }, [])

  useEffect(() => {
    if (isOpen) lenis.current?.stop()
    else lenis.current?.start()
  }, [isOpen, lenis])

  /** Re-price whenever the lines change — ids, sizes, quantities, embroidery. */
  const quoteKey = JSON.stringify(
    items.map((item) => [
      typeof item.product === 'object' ? item.product?.id : item.product,
      typeof item.variant === 'object' ? item.variant?.id : item.variant,
      item.quantity,
      (item as { personalisation?: unknown }).personalisation ?? [],
    ]),
  )

  useEffect(() => {
    if (!items.length) {
      setQuote(null)
      return
    }
    const controller = new AbortController()
    fetch('/api/quote', {
      body: JSON.stringify({
        items: items.map((item) => ({
          personalisation: (item as { personalisation?: unknown }).personalisation ?? [],
          productId: typeof item.product === 'object' ? item.product?.id : item.product,
          quantity: item.quantity,
          variantId: typeof item.variant === 'object' ? item.variant?.id : item.variant,
        })),
      }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((body: null | Quote) => setQuote(body))
      .catch(() => undefined)
    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteKey])

  // Only trust per-line figures when the quote priced exactly these lines.
  const lineQuotes = quote && quote.lines.length === items.length ? quote.lines : null

  return (
    <Dialog.Root onOpenChange={setIsOpen} open={isOpen}>
      <Dialog.Trigger asChild>
        <OpenCartButton quantity={count || undefined} />
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/30 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[28rem] flex-col bg-background duration-500 ease-brand data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:animate-in data-[state=open]:slide-in-from-right"
        >
          <header className="flex items-center justify-between border-b border-line px-7 py-6">
            <Dialog.Title className="serif-display text-3xl">
              Your bag
              {count ? <span className="ml-2 align-middle text-sm text-ink-soft">({count})</span> : null}
            </Dialog.Title>
            <Dialog.Close aria-label="Close bag" className="-mr-1 p-1">
              <X className="size-5" strokeWidth={1.25} />
            </Dialog.Close>
          </header>

          {!items.length ? (
            <div className="flex flex-1 flex-col items-center justify-center px-7 text-center">
              <p className="serif-display text-3xl">Your bag is empty.</p>
              <p className="mt-3 text-sm text-ink-soft">Every piece is hand-finished to order in Doha.</p>
              <Link className="caps mt-8 bg-ink px-8 py-4 text-[0.6875rem] text-white hover:bg-ink/85" href="/shop">
                Visit the shop
              </Link>
            </div>
          ) : (
            <>
              <ul className="flex-1 overflow-y-auto px-7" data-lenis-prevent>
                {items.map((item, index) => {
                  const product = typeof item.product === 'object' ? (item.product as Product) : null
                  if (!product?.slug) return null

                  const variant = typeof item.variant === 'object' ? (item.variant as Variant) : null
                  const size = variant?.options
                    ?.map((o) => (typeof o === 'object' ? (o as VariantOption).label : null))
                    .filter(Boolean)
                    .join(' / ')
                  const image = product.gallery?.find((g) => typeof g.image === 'object')?.image as
                    | Media
                    | undefined

                  const line = lineQuotes?.[index]
                  const unit = variant?.priceInQAR ?? product.priceInQAR ?? 0
                  const lineTotal = line ? line.subtotal + line.personalisationTotal : unit * (item.quantity || 1)

                  const target = variant ?? product
                  const atStock =
                    typeof target.inventory === 'number' && (item.quantity || 0) >= target.inventory

                  return (
                    <li className="flex gap-5 border-b border-line py-6" key={item.id ?? index}>
                      <Link
                        className="relative aspect-[4/5] w-20 shrink-0 overflow-hidden bg-paper-3"
                        href={`/products/${product.slug}`}
                      >
                        {image?.url ? (
                          <Image alt={image.alt || product.title} className="object-cover" fill sizes="80px" src={image.url} />
                        ) : null}
                      </Link>

                      <div className="flex min-w-0 flex-1 flex-col">
                        <div className="flex items-baseline justify-between gap-3">
                          <Link className="serif-display text-lg leading-snug" href={`/products/${product.slug}`}>
                            {product.title.split(/\s+[—–]\s+/)[0]}
                          </Link>
                          <span className="shrink-0 text-sm tabular-nums">{formatQar(lineTotal)}</span>
                        </div>
                        {size ? <p className="mt-1 text-xs text-ink-soft">Size {size}</p> : null}
                        {line?.personalisation.map((p) => (
                          <p className="serif-italic mt-1 text-[0.8125rem] text-ink-soft" key={p.placementName}>
                            Embroidery — {describe(p)}
                          </p>
                        ))}

                        <div className="mt-auto flex items-center justify-between pt-4">
                          <div className="flex items-center border border-line">
                            <button
                              aria-label="One fewer"
                              className="flex size-8 items-center justify-center disabled:opacity-40"
                              disabled={isLoading || !item.id}
                              onClick={() => item.id && decrementItem(item.id)}
                              type="button"
                            >
                              −
                            </button>
                            <span className="w-6 text-center text-xs tabular-nums">{item.quantity}</span>
                            <button
                              aria-label="One more"
                              className="flex size-8 items-center justify-center disabled:opacity-40"
                              disabled={isLoading || !item.id || atStock}
                              onClick={() => item.id && incrementItem(item.id)}
                              title={atStock ? 'That is all we have in this size' : undefined}
                              type="button"
                            >
                              +
                            </button>
                          </div>
                          <button
                            className="caps text-[0.5625rem] text-ink-soft underline-offset-4 hover:text-ink hover:underline"
                            disabled={isLoading || !item.id}
                            onClick={() => item.id && removeItem(item.id)}
                            type="button"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>

              <footer className="border-t border-line px-7 py-6">
                <dl className="flex flex-col gap-2 text-sm">
                  <Row label="Pieces" value={quote ? formatQar(quote.totals.subtotal) : '—'} />
                  {quote && quote.totals.personalisation > 0 ? (
                    <Row label="Embroidery" value={formatQar(quote.totals.personalisation)} />
                  ) : null}
                  <Row label="Delivery" muted value="Calculated at checkout" />
                  <div className="mt-2 flex items-baseline justify-between border-t border-line pt-3">
                    <dt className="caps text-[0.625rem]">Total</dt>
                    <dd className="text-base tabular-nums">{quote ? formatQar(quote.totals.total) : '—'}</dd>
                  </div>
                </dl>
                <p className="mt-3 text-xs text-ink-soft">All orders are charged in QAR.</p>
                <Link
                  className={cn(
                    'caps mt-5 flex h-12 w-full items-center justify-center bg-ink text-[0.6875rem] text-white hover:bg-ink/85',
                    isLoading && 'pointer-events-none bg-ink/70',
                  )}
                  href="/checkout"
                >
                  Checkout
                </Link>
                <Dialog.Close className="caps mx-auto mt-4 block text-[0.5625rem] text-ink-soft underline-offset-4 hover:underline">
                  Continue shopping
                </Dialog.Close>
              </footer>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function Row({ label, muted, value }: { label: string; muted?: boolean; value: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className="caps text-[0.625rem] text-ink-soft">{label}</dt>
      <dd className={cn('tabular-nums', muted && 'text-xs text-ink-soft')}>{value}</dd>
    </div>
  )
}
