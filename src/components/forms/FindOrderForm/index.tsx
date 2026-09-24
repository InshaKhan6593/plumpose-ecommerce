'use client'

import { useAuth } from '@/providers/Auth'
import React, { useCallback, useState } from 'react'
import { useForm } from 'react-hook-form'

import { HouseAlert, HouseButton, HouseField, houseInput } from '@/components/forms/house'
import { TRACK_PAGE } from '@/content/pages'

import { sendOrderAccessEmail } from './sendOrderAccessEmail'

type FormData = {
  email: string
  orderID: string
}

type Props = {
  initialEmail?: string
}

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
      <HouseField error={errors.email?.message} id="email" label="Email">
        <input
          aria-invalid={Boolean(errors.email)}
          autoComplete="email"
          className={houseInput}
          id="email"
          {...register('email', { required: 'Please enter the email you ordered with.' })}
          type="email"
        />
      </HouseField>
      <HouseField error={errors.orderID?.message} id="orderID" label="Order number">
        <input
          aria-invalid={Boolean(errors.orderID)}
          className={houseInput}
          id="orderID"
          inputMode="numeric"
          placeholder="e.g. 105"
          {...register('orderID', {
            required: 'Please enter your order number.',
            validate: (v) => /\d/.test(v) || 'Your order number is in your confirmation email.',
          })}
          type="text"
        />
      </HouseField>
      {submitError ? <HouseAlert>{submitError}</HouseAlert> : null}
      <HouseButton className="w-full" disabled={isSubmitting}>
        {isSubmitting ? 'Sending…' : 'Find my order'}
      </HouseButton>
    </form>
  )
}
