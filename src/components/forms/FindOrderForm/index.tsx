'use client'

import { useAuth } from '@/providers/Auth'
import React, { useCallback, useState } from 'react'
import { useForm } from 'react-hook-form'

import { TRACK_PAGE } from '@/content/pages'
import { cn } from '@/utilities/cn'

import { sendOrderAccessEmail } from './sendOrderAccessEmail'

type FormData = {
  email: string
  orderID: string
}

type Props = {
  initialEmail?: string
}

/** Underlined single-line inputs, as the checkout uses. */
const inputClass =
  'w-full border-0 border-b border-line bg-transparent px-0 pt-2 pb-3 text-[0.9375rem] placeholder:text-ink-faint focus:border-ink focus:ring-0 focus-visible:outline-none'

/**
 * Email + order number → a private link to the order, by email. The server
 * action answers the same whether or not an order matched (see
 * sendOrderAccessEmail), so this form cannot be used to probe who ordered.
 */
export const FindOrderForm: React.FC<Props> = ({ initialEmail }) => {
  const { user } = useAuth()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const {
    formState: { errors },
    handleSubmit,
    register,
  } = useForm<FormData>({
    defaultValues: {
      email: initialEmail || user?.email,
    },
  })

  const onSubmit = useCallback(async (data: FormData) => {
    setIsSubmitting(true)
    setSubmitError(null)

    try {
      const result = await sendOrderAccessEmail({
        email: data.email.trim(),
        // Accept "#105" or "105" — the order number as the confirmation email shows it.
        orderID: data.orderID.replace(/[^\d]/g, ''),
      })

      if (result.success) {
        setSuccess(true)
      } else {
        setSubmitError(result.error || 'Something went wrong. Please try again.')
      }
    } catch {
      setSubmitError('Something went wrong. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }, [])

  if (success) {
    return (
      <div aria-live="polite" className="border border-line px-7 py-8 text-center">
        <p className="serif-display text-[2rem]">{TRACK_PAGE.sent.heading}</p>
        <p className="mx-auto mt-3 max-w-sm text-[0.9375rem] leading-relaxed text-ink-soft">{TRACK_PAGE.sent.body}</p>
      </div>
    )
  }

  return (
    <form className="flex flex-col gap-9" noValidate onSubmit={handleSubmit(onSubmit)}>
      <div>
        <label className="caps block text-[0.5625rem] text-ink-soft" htmlFor="email">
          Email
        </label>
        <input
          aria-invalid={Boolean(errors.email)}
          autoComplete="email"
          className={inputClass}
          id="email"
          {...register('email', { required: 'Please enter the email you ordered with.' })}
          type="email"
        />
        {errors.email ? <p className="mt-2 text-[0.8125rem] text-[#8a2424]">{errors.email.message}</p> : null}
      </div>
      <div>
        <label className="caps block text-[0.5625rem] text-ink-soft" htmlFor="orderID">
          Order number
        </label>
        <input
          aria-invalid={Boolean(errors.orderID)}
          className={inputClass}
          id="orderID"
          inputMode="numeric"
          placeholder="e.g. 105"
          {...register('orderID', {
            required: 'Please enter your order number.',
            validate: (v) => /\d/.test(v) || 'Your order number is in your confirmation email.',
          })}
          type="text"
        />
        {errors.orderID ? <p className="mt-2 text-[0.8125rem] text-[#8a2424]">{errors.orderID.message}</p> : null}
      </div>
      {submitError ? (
        <p className="text-[0.8125rem] text-[#8a2424]" role="alert">
          {submitError}
        </p>
      ) : null}
      <button
        className={cn(
          'caps inline-flex h-12 w-full items-center justify-center bg-ink text-[0.6875rem] text-white transition-colors hover:bg-ink/85',
          isSubmitting && 'opacity-60',
        )}
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? 'Sending…' : 'Find my order'}
      </button>
    </form>
  )
}
