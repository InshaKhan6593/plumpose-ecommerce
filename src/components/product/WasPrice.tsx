'use client'

import React from 'react'

import { Money } from '@/providers/Locale'
import { cn } from '@/utilities/cn'

/**
 * The price it was, crossed out, before today's price (REQUIREMENTS A3).
 * Shown only when it is higher than the price; screen readers hear
 * "was QAR 1,599.00, now".
 */
export function WasPrice({ className, price, was }: { className?: string; price: null | number | undefined; was: null | number | undefined }) {
  if (typeof was !== 'number' || typeof price !== 'number' || was <= price) return null
  return (
    <span className={cn('mr-3 text-ink-soft', className)}>
      <span className="sr-only">was </span>
      <s>
        <Money minor={was} />
      </s>
      <span className="sr-only">, now </span>
    </span>
  )
}
