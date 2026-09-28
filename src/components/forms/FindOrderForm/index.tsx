'use client'

import { useAuth } from '@/providers/Auth'
import React, { useCallback, useState } from 'react'
import { useForm } from 'react-hook-form'

import { HouseAlert, HouseButton, HouseField, houseInput } from '@/components/forms/house'
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

/**
 * Email + order number → a private link to the order, by email. The server
 * action answers the same whether or not an order matched (see
 * sendOrderAccessEmail), so this form cannot be used to probe who ordered.
 */
export const FindOrderForm: React.FC<Props & { sent?: { body: string; heading: string } }> = ({
  initialEmail,
  sent = TRACK_PAGE.sent,
}) => {
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
        // As typed: the server reads a code ("PLM-250928-7K4QX2") or an older number ("#105").
        orderID: data.orderID.trim(),
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
        <p className="serif-display text-[2rem]">{sent.heading}</p>
        <p className="mx-auto mt-3 max-w-sm text-[0.9375rem] leading-relaxed text-ink-soft">
          {sent.body}
        </p>
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
      <HouseField error={errors.orderID?.message} id="orderID" label="Order code">
        <input
          aria-invalid={Boolean(errors.orderID)}
          autoCapitalize="characters"
          className={cn(houseInput, 'uppercase')}
          id="orderID"
          placeholder="e.g. PLM-250928-7K4QX2"
          spellCheck={false}
          {...register('orderID', {
            required: 'Please enter your order code.',
            validate: (v) => /\d/.test(v) || 'Your order code is in your confirmation email.',
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
