import React from 'react'

import { cn } from '@/utilities/cn'

/**
 * The house form parts, as the checkout draws them: underlined single-line
 * inputs, small letterspaced labels, errors in the one red the site uses.
 * Shared by Contact, Track order and the account pages.
 */

export const houseInput =
  'w-full border-0 border-b border-line bg-transparent px-0 pt-2 pb-3 text-[0.9375rem] text-ink placeholder:text-ink-faint transition-colors focus:border-ink focus:ring-0 focus-visible:outline-none aria-[invalid=true]:border-[#8a2424]'

export function HouseField({
  children,
  className,
  error,
  hint,
  id,
  label,
}: {
  children: React.ReactNode
  className?: string
  error?: string
  hint?: string
  id: string
  label: string
}) {
  return (
    <div className={className}>
      <label className="caps block text-[0.5625rem] text-ink-soft" htmlFor={id}>
        {label}
      </label>
      {children}
      {error ? (
        <p className="mt-2 text-[0.8125rem] text-[#8a2424]" id={`${id}-error`}>
          {error}
        </p>
      ) : hint ? (
        <p className="mt-2 text-[0.75rem] text-ink-soft">{hint}</p>
      ) : null}
    </div>
  )
}

export function HouseButton({
  children,
  className,
  disabled,
  type = 'submit',
  variant = 'solid',
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'outline' | 'solid' }) {
  return (
    <button
      className={cn(
        'caps inline-flex h-12 items-center justify-center px-12 text-[0.6875rem] transition-colors disabled:opacity-40',
        variant === 'solid'
          ? 'bg-ink text-white hover:bg-ink/85'
          : // Transparent stated outright: a disabled button otherwise shows the browser's grey.
            'border border-ink bg-transparent text-ink hover:bg-ink hover:text-white disabled:hover:bg-transparent disabled:hover:text-ink',
        className,
      )}
      disabled={disabled}
      type={type}
      {...rest}
    >
      {children}
    </button>
  )
}

/** A message above or below a form. `role` makes errors announce themselves. */
export function HouseAlert({ children, tone = 'error' }: { children: React.ReactNode; tone?: 'error' | 'note' }) {
  return (
    <p
      className={cn(
        'text-[0.8125rem] leading-relaxed',
        tone === 'error' ? 'text-[#8a2424]' : 'border-l border-ink pl-4 text-ink-soft',
      )}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      {children}
    </p>
  )
}
