'use client'

import type { Product } from '@/payload-types'

import Link from 'next/link'
import React, { Suspense, useState } from 'react'

import { AddToCart } from '@/components/Cart/AddToCart'
import { RichText } from '@/components/RichText'
import { Reveal } from '@/motion/Reveal'
import { splitTitle } from '@/utilities/splitTitle'
import { toMinor } from '@/lib/pricing/money'
import { ChargedInQar, Money } from '@/providers/Locale'

import { describeChoice, type EmbroideryChoice, type EmbroideryOption, type EmbroideryRules } from './embroidery'
import { EmbroideryDrawer } from './EmbroideryDrawer'
import { VariantSelector } from './VariantSelector'

export type ProductDetail = {
  lines?: string[]
  rich?: NonNullable<Product['materialCare']>
  title: string
}

/**
 * The product page's right-hand column (docs/mockups/06-product-page.webp).
 *
 * The price is the lowest variant price, because a size has to be chosen before
 * anything is added; every size costs the same today, so this reads as one
 * price. Stock and price are re-checked on the server at payment regardless.
 */
export function ProductInfo({
  categoryTitle,
  details,
  embroideryOptions,
  embroideryRules,
  product,
}: {
  categoryTitle: null | string
  details: ProductDetail[]
  embroideryOptions: EmbroideryOption[]
  embroideryRules: EmbroideryRules | null
  product: Product
}) {
  const { name, subtitle } = splitTitle(product.title)

  /** Embroidery chosen for the piece about to be added to the bag. */
  const [embroidery, setEmbroidery] = useState<EmbroideryChoice[]>([])
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<null | number>(null)

  const canEmbroider = Boolean(product.personalisationEnabled && embroideryRules && embroideryOptions.length)
  const canAddPlacement = embroideryRules ? embroidery.length < embroideryRules.maxPlacements : false

  const openDrawer = (index: null | number) => {
    setEditing(index)
    setDrawerOpen(true)
  }

  const saveChoice = (choice: EmbroideryChoice) =>
    setEmbroidery((list) =>
      editing === null ? [...list, choice] : list.map((c, i) => (i === editing ? choice : c)),
    )

  const variantPrices = (product.variants?.docs ?? [])
    .map((variant) => (typeof variant === 'object' ? variant.priceInQAR : null))
    .filter((price): price is number => typeof price === 'number')
  const price = variantPrices.length ? Math.min(...variantPrices) : product.priceInQAR

  return (
    <Reveal className="flex flex-col">
      <nav aria-label="Breadcrumb" className="caps mb-6 text-[0.625rem] text-ink-soft" data-reveal>
        <Link className="hover:text-ink" href="/shop">
          Shop
        </Link>
        {categoryTitle ? (
          <>
            <span aria-hidden className="mx-2">
              /
            </span>
            <span>{categoryTitle}</span>
          </>
        ) : null}
      </nav>

      <h1 className="serif-display text-[2.75rem] md:text-[3.75rem]" data-reveal-lines>
        {name}
      </h1>
      {subtitle ? (
        <p className="serif-italic mt-3 text-2xl text-ink" data-reveal>
          {subtitle}
        </p>
      ) : null}

      {typeof price === 'number' ? (
        <div className="mt-7" data-reveal>
          <Money className="text-base tracking-[0.12em] tabular-nums" minor={price} />
          <ChargedInQar className="mt-1.5 block text-[0.75rem] text-ink-soft" minor={price} />
        </div>
      ) : null}

      {product.description ? (
        <div className="mt-6 max-w-md text-[0.9375rem] leading-relaxed text-ink-soft" data-reveal>
          <RichText
            className="[&_p]:m-0 [&_p+p]:mt-3"
            data={product.description}
            enableGutter={false}
            enableProse={false}
          />
        </div>
      ) : null}

      <div className="mt-9" data-reveal>
        <Suspense fallback={<div className="h-[4.75rem]" />}>
          <VariantSelector product={product} />
        </Suspense>
      </div>

      {canEmbroider && embroideryRules ? (
        <div className="mt-7 max-w-lg border border-line px-7 py-6" data-reveal id="personalisation">
          <div className="flex items-baseline justify-between gap-4">
            <p className="caps text-[0.625rem] text-ink">Hand embroidery</p>
            {embroidery.length ? (
              <p className="text-sm text-ink tabular-nums">
                + QAR {embroideryRules.feeQar * embroidery.length}
              </p>
            ) : null}
          </div>

          {embroidery.length ? (
            <ul className="mt-3 flex flex-col gap-2">
              {embroidery.map((choice, index) => (
                <li className="flex items-baseline justify-between gap-4 text-sm" key={choice.placement}>
                  <span className="text-ink-soft">{describeChoice(choice, embroideryOptions)}</span>
                  <span className="flex shrink-0 gap-4">
                    <button className="caps text-[0.5625rem] underline-offset-4 hover:underline" onClick={() => openDrawer(index)} type="button">
                      Edit
                    </button>
                    <button
                      className="caps text-[0.5625rem] text-ink-soft underline-offset-4 hover:underline"
                      onClick={() => setEmbroidery((list) => list.filter((_, i) => i !== index))}
                      type="button"
                    >
                      Remove
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-ink-soft">
              Add initials or a symbol. From <Money className="text-ink" minor={toMinor(embroideryRules.feeQar)} />.
            </p>
          )}

          {canAddPlacement ? (
            <button
              className="caps mt-4 border-b border-ink pb-0.5 text-[0.625rem]"
              onClick={() => openDrawer(null)}
              type="button"
            >
              {embroidery.length ? 'Add another placement' : 'Personalise'}
            </button>
          ) : null}

          <EmbroideryDrawer
            initial={editing === null ? null : embroidery[editing]}
            onOpenChange={setDrawerOpen}
            onSave={saveChoice}
            open={drawerOpen}
            options={embroideryOptions}
            rules={embroideryRules}
            usedPlacements={embroidery.map((c) => c.placement)}
          />
        </div>
      ) : null}

      <div className="mt-7 max-w-sm" data-reveal>
        <Suspense fallback={<div className="h-12 bg-ink/80" />}>
          <AddToCart onAdded={() => setEmbroidery([])} personalisation={embroidery} product={product} />
        </Suspense>
      </div>

      {details.length ? (
        <div className="mt-8 border-t border-line" data-reveal>
          {details.map((detail) => (
            <details className="group border-b border-line" key={detail.title}>
              <summary className="caps flex cursor-pointer list-none items-center justify-between py-5 text-[0.625rem] text-ink [&::-webkit-details-marker]:hidden">
                {detail.title}
                <span aria-hidden className="relative size-3">
                  <span className="absolute top-1/2 left-0 h-px w-3 bg-ink" />
                  <span className="absolute top-0 left-1/2 h-3 w-px bg-ink transition-transform duration-300 ease-brand group-open:scale-y-0" />
                </span>
              </summary>
              <div className="pb-6 text-sm leading-relaxed text-ink-soft">
                {detail.rich ? (
                  <RichText
                    className="[&_p]:m-0 [&_p+p]:mt-3"
                    data={detail.rich}
                    enableGutter={false}
                    enableProse={false}
                  />
                ) : (
                  <ul className="flex flex-col gap-2">
                    {detail.lines?.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                )}
              </div>
            </details>
          ))}
        </div>
      ) : null}
    </Reveal>
  )
}
