'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useForm } from 'react-hook-form'

import type { User } from '@/payload-types'

import { HouseAlert, HouseButton, HouseField, houseInput } from '@/components/forms/house'
import { useAuth } from '@/providers/Auth'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const MIN_PASSWORD = 8

type Status = { text: string; tone: 'error' | 'note' } | null

/**
 * Name and email, and — separately — a new password. Two forms, so changing
 * one never sends the other. Both PATCH the signed-in user; `users.update` is
 * admin-or-self, so this can only ever change the account it is signed in to.
 */
export function DetailsForm({ user }: { user: Pick<User, 'email' | 'id' | 'name'> }) {
  const { setUser } = useAuth()
  const router = useRouter()

  const save = async (data: Partial<{ email: string; name: string; password: string }>) => {
    const res = await fetch(`/api/users/${user.id}`, {
      body: JSON.stringify(data),
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      method: 'PATCH',
    })
    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as {
        errors?: Array<{ data?: { errors?: Array<{ path?: string }> } }>
      }
      const taken = json.errors?.some((e) => e.data?.errors?.some((f) => f.path === 'email'))
      throw new Error(
        taken
          ? 'There is already an account with this email.'
          : 'That didn’t save. Please try again.',
      )
    }
    const { doc } = (await res.json()) as { doc: User }
    setUser(doc)
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-16">
      <ProfileForm onSave={save} user={user} />
      <PasswordForm onSave={save} />
    </div>
  )
}

function ProfileForm({
  onSave,
  user,
}: {
  onSave: (data: { email: string; name: string }) => Promise<void>
  user: Pick<User, 'email' | 'name'>
}) {
  const [status, setStatus] = useState<Status>(null)
  const {
    formState: { errors, isDirty, isSubmitting },
    handleSubmit,
    register,
    reset,
  } = useForm({ defaultValues: { email: user.email, name: user.name ?? '' } })

  const onSubmit = handleSubmit(async (data) => {
    setStatus(null)
    try {
      await onSave({ email: data.email.trim(), name: data.name.trim() })
      reset(data)
      setStatus({ text: 'Saved.', tone: 'note' })
    } catch (e) {
      setStatus({ text: (e as Error).message, tone: 'error' })
    }
  })

  return (
    <form className="flex max-w-lg flex-col gap-8" noValidate onSubmit={onSubmit}>
      <HouseField error={errors.name?.message} id="name" label="Name">
        <input
          aria-invalid={Boolean(errors.name)}
          autoComplete="name"
          className={houseInput}
          id="name"
          maxLength={120}
          {...register('name', { required: 'Please tell us your name.' })}
        />
      </HouseField>
      <HouseField
        error={errors.email?.message}
        hint="Your order emails and sign-in both use this address."
        id="email"
        label="Email"
      >
        <input
          aria-invalid={Boolean(errors.email)}
          autoComplete="email"
          className={houseInput}
          id="email"
          type="email"
          {...register('email', {
            pattern: { message: 'Please check the email address.', value: EMAIL },
            required: 'Please enter your email.',
          })}
        />
      </HouseField>
      {status ? <HouseAlert tone={status.tone}>{status.text}</HouseAlert> : null}
      <HouseButton className="self-start" disabled={!isDirty || isSubmitting} variant="outline">
        {isSubmitting ? 'Saving…' : 'Save details'}
      </HouseButton>
    </form>
  )
}

function PasswordForm({ onSave }: { onSave: (data: { password: string }) => Promise<void> }) {
  const [status, setStatus] = useState<Status>(null)
  const {
    formState: { errors, isSubmitting },
    getValues,
    handleSubmit,
    register,
    reset,
  } = useForm({ defaultValues: { password: '', passwordConfirm: '' } })

  const onSubmit = handleSubmit(async ({ password }) => {
    setStatus(null)
    try {
      await onSave({ password })
      reset()
      setStatus({ text: 'Your password has been changed.', tone: 'note' })
    } catch (e) {
      setStatus({ text: (e as Error).message, tone: 'error' })
    }
  })

  return (
    <form className="flex max-w-lg flex-col gap-8" noValidate onSubmit={onSubmit}>
      <h2 className="caps border-b border-line pb-4 text-[0.6875rem]">Change password</h2>
      <HouseField
        error={errors.password?.message}
        hint={`At least ${MIN_PASSWORD} characters.`}
        id="new-password"
        label="New password"
      >
        <input
          aria-invalid={Boolean(errors.password)}
          autoComplete="new-password"
          className={houseInput}
          id="new-password"
          type="password"
          {...register('password', {
            minLength: {
              message: `Please use at least ${MIN_PASSWORD} characters.`,
              value: MIN_PASSWORD,
            },
            required: 'Please choose a new password.',
          })}
        />
      </HouseField>
      <HouseField
        error={errors.passwordConfirm?.message}
        id="new-password-confirm"
        label="New password, again"
      >
        <input
          aria-invalid={Boolean(errors.passwordConfirm)}
          autoComplete="new-password"
          className={houseInput}
          id="new-password-confirm"
          type="password"
          {...register('passwordConfirm', {
            required: 'Please type it again.',
            validate: (value) =>
              value === getValues('password') || 'The two passwords don’t match.',
          })}
        />
      </HouseField>
      {status ? <HouseAlert tone={status.tone}>{status.text}</HouseAlert> : null}
      <HouseButton className="self-start" disabled={isSubmitting} variant="outline">
        {isSubmitting ? 'Saving…' : 'Change password'}
      </HouseButton>
    </form>
  )
}
