'use client'

import { useEcommerce } from '@payloadcms/plugin-ecommerce/client/react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getSafeRedirect } from 'payload/shared'
import React, { useState } from 'react'
import { useForm } from 'react-hook-form'

import type { User } from '@/payload-types'

import { HouseAlert, HouseButton, HouseField, houseInput } from '@/components/forms/house'
import { AuthError, type AuthErrorCode, useAuth } from '@/providers/Auth'

import { noticeHref } from './notices'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const MIN_PASSWORD = 8

const MESSAGES: Record<AuthErrorCode, string> = {
  'email-taken': 'There is already an account with this email. Sign in, or reset your password.',
  'invalid-credentials': 'That email and password don’t match. Try again, or reset your password.',
  'invalid-token': 'This link has expired or has already been used. Ask for a new one below.',
  locked: 'Too many attempts. Please wait a few minutes, or reset your password.',
  unknown: 'That didn’t work. Please try again in a moment.',
}
const messageFor = (error: unknown) => MESSAGES[error instanceof AuthError ? error.code : 'unknown']

/**
 * The ecommerce plugin keeps its own copy of who is signed in, and must be
 * told: `onLogin` moves a guest's bag into the account's cart (merging it with
 * one already there), `onLogout` forgets the cart and addresses on this device.
 * Without these the bag was lost on sign-in, and after sign-out the plugin kept
 * asking the API for a user who had gone.
 */
const useBagSync = () => {
  const { onLogin, onLogout } = useEcommerce()
  return {
    afterSignIn: async () => {
      // Never let a cart hiccup stop someone from reaching their account.
      await onLogin().catch(() => undefined)
    },
    afterSignOut: onLogout,
  }
}

/** Where to go after signing in: `?redirect=` if it is a path on this site, else the account. */
const destination = (redirect: string | undefined, user: User) =>
  // The client runs the shop from the admin; everyone else lands in their account.
  getSafeRedirect({ fallbackTo: user.roles?.includes('admin') ? '/admin' : '/account', redirectTo: redirect ?? '' })

/* ---------------------------------------------------------------- sign in */

export function SignInForm({ redirect }: { redirect?: string }) {
  const { login } = useAuth()
  const { afterSignIn } = useBagSync()
  const router = useRouter()
  const [error, setError] = useState<null | string>(null)
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
  } = useForm<{ email: string; password: string }>()

  const onSubmit = handleSubmit(async (data) => {
    setError(null)
    try {
      const user = await login({ email: data.email.trim(), password: data.password })
      await afterSignIn()
      router.push(destination(redirect, user))
      router.refresh()
    } catch (e) {
      setError(messageFor(e))
    }
  })

  const query = redirect ? `?redirect=${encodeURIComponent(redirect)}` : ''

  return (
    <form className="flex flex-col gap-8" noValidate onSubmit={onSubmit}>
      <HouseField error={errors.email?.message} id="email" label="Email">
        <input
          aria-invalid={Boolean(errors.email)}
          autoComplete="email"
          className={houseInput}
          id="email"
          type="email"
          {...register('email', { pattern: { message: 'Please check the email address.', value: EMAIL }, required: 'Please enter your email.' })}
        />
      </HouseField>
      <HouseField error={errors.password?.message} id="password" label="Password">
        <input
          aria-invalid={Boolean(errors.password)}
          autoComplete="current-password"
          className={houseInput}
          id="password"
          type="password"
          {...register('password', { required: 'Please enter your password.' })}
        />
      </HouseField>
      <Link className="-mt-4 self-end text-[0.8125rem] text-ink-soft underline-offset-4 hover:text-ink hover:underline" href={`/forgot-password${query}`}>
        Forgotten your password?
      </Link>
      {error ? <HouseAlert>{error}</HouseAlert> : null}
      <HouseButton className="w-full" disabled={isSubmitting}>
        {isSubmitting ? 'Signing in…' : 'Sign in'}
      </HouseButton>
    </form>
  )
}

/* -------------------------------------------------------- create account */

export function CreateAccountForm({ redirect }: { redirect?: string }) {
  const { create } = useAuth()
  const { afterSignIn } = useBagSync()
  const router = useRouter()
  const [error, setError] = useState<null | string>(null)
  const {
    formState: { errors, isSubmitting },
    getValues,
    handleSubmit,
    register,
  } = useForm<{ email: string; name: string; password: string; passwordConfirm: string }>()

  const onSubmit = handleSubmit(async (data) => {
    setError(null)
    try {
      const user = await create({ email: data.email.trim(), name: data.name.trim(), password: data.password })
      await afterSignIn()
      const next = destination(redirect, user)
      router.push(next === '/account' ? noticeHref('/account', 'account-created') : next)
      router.refresh()
    } catch (e) {
      setError(messageFor(e))
    }
  })

  return (
    <form className="flex flex-col gap-8" noValidate onSubmit={onSubmit}>
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
      <HouseField error={errors.email?.message} id="email" label="Email">
        <input
          aria-invalid={Boolean(errors.email)}
          autoComplete="email"
          className={houseInput}
          id="email"
          type="email"
          {...register('email', { pattern: { message: 'Please check the email address.', value: EMAIL }, required: 'Please enter your email.' })}
        />
      </HouseField>
      <HouseField error={errors.password?.message} hint={`At least ${MIN_PASSWORD} characters.`} id="password" label="Password">
        <input
          aria-invalid={Boolean(errors.password)}
          autoComplete="new-password"
          className={houseInput}
          id="password"
          type="password"
          {...register('password', {
            minLength: { message: `Please use at least ${MIN_PASSWORD} characters.`, value: MIN_PASSWORD },
            required: 'Please choose a password.',
          })}
        />
      </HouseField>
      <HouseField error={errors.passwordConfirm?.message} id="passwordConfirm" label="Password, again">
        <input
          aria-invalid={Boolean(errors.passwordConfirm)}
          autoComplete="new-password"
          className={houseInput}
          id="passwordConfirm"
          type="password"
          {...register('passwordConfirm', {
            required: 'Please type your password again.',
            validate: (value) => value === getValues('password') || 'The two passwords don’t match.',
          })}
        />
      </HouseField>
      {error ? <HouseAlert>{error}</HouseAlert> : null}
      <HouseButton className="w-full" disabled={isSubmitting}>
        {isSubmitting ? 'Creating your account…' : 'Create account'}
      </HouseButton>
      <p className="text-[0.75rem] leading-relaxed text-ink-soft">
        You never need an account to order — it simply keeps your orders and addresses in one place.
      </p>
    </form>
  )
}

/* ------------------------------------------------------ forgotten password */

export function ForgotPasswordForm() {
  const { forgotPassword } = useAuth()
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<null | string>(null)
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
  } = useForm<{ email: string }>()

  const onSubmit = handleSubmit(async ({ email }) => {
    setError(null)
    try {
      await forgotPassword({ email: email.trim() })
      setSent(true)
    } catch (e) {
      setError(messageFor(e))
    }
  })

  if (sent) {
    // The same reply whether or not the address has an account.
    return (
      <div aria-live="polite" className="border border-line px-7 py-8 text-center">
        <p className="serif-display text-[2rem]">Check your email</p>
        <p className="mx-auto mt-3 max-w-sm text-[0.9375rem] leading-relaxed text-ink-soft">
          If there is an account for that address, a link to choose a new password is on its way. It works for one hour.
        </p>
      </div>
    )
  }

  return (
    <form className="flex flex-col gap-8" noValidate onSubmit={onSubmit}>
      <HouseField error={errors.email?.message} id="email" label="Email">
        <input
          aria-invalid={Boolean(errors.email)}
          autoComplete="email"
          className={houseInput}
          id="email"
          type="email"
          {...register('email', { pattern: { message: 'Please check the email address.', value: EMAIL }, required: 'Please enter your email.' })}
        />
      </HouseField>
      {error ? <HouseAlert>{error}</HouseAlert> : null}
      <HouseButton className="w-full" disabled={isSubmitting}>
        {isSubmitting ? 'Sending…' : 'Send the link'}
      </HouseButton>
    </form>
  )
}

/* -------------------------------------------------------- reset password */

export function ResetPasswordForm({ token }: { token: string }) {
  const { resetPassword } = useAuth()
  const { afterSignIn } = useBagSync()
  const router = useRouter()
  const [error, setError] = useState<null | string>(null)
  const {
    formState: { errors, isSubmitting },
    getValues,
    handleSubmit,
    register,
  } = useForm<{ password: string; passwordConfirm: string }>()

  const onSubmit = handleSubmit(async ({ password }) => {
    setError(null)
    try {
      const user = await resetPassword({ password, token })
      await afterSignIn()
      const next = destination(undefined, user)
      router.push(next === '/account' ? noticeHref('/account/details', 'password-changed') : next)
      router.refresh()
    } catch (e) {
      setError(messageFor(e))
    }
  })

  return (
    <form className="flex flex-col gap-8" noValidate onSubmit={onSubmit}>
      <HouseField error={errors.password?.message} hint={`At least ${MIN_PASSWORD} characters.`} id="password" label="New password">
        <input
          aria-invalid={Boolean(errors.password)}
          autoComplete="new-password"
          className={houseInput}
          id="password"
          type="password"
          {...register('password', {
            minLength: { message: `Please use at least ${MIN_PASSWORD} characters.`, value: MIN_PASSWORD },
            required: 'Please choose a new password.',
          })}
        />
      </HouseField>
      <HouseField error={errors.passwordConfirm?.message} id="passwordConfirm" label="New password, again">
        <input
          aria-invalid={Boolean(errors.passwordConfirm)}
          autoComplete="new-password"
          className={houseInput}
          id="passwordConfirm"
          type="password"
          {...register('passwordConfirm', {
            required: 'Please type it again.',
            validate: (value) => value === getValues('password') || 'The two passwords don’t match.',
          })}
        />
      </HouseField>
      {error ? (
        <HouseAlert>
          {error}{' '}
          {error === MESSAGES['invalid-token'] ? (
            <Link className="underline underline-offset-4" href="/forgot-password">
              Send a new link
            </Link>
          ) : null}
        </HouseAlert>
      ) : null}
      <HouseButton className="w-full" disabled={isSubmitting}>
        {isSubmitting ? 'Saving…' : 'Save new password'}
      </HouseButton>
    </form>
  )
}

/* ---------------------------------------------------------------- sign out */

export function SignOut() {
  const { logout } = useAuth()
  const { afterSignOut } = useBagSync()
  const router = useRouter()
  const [state, setState] = useState<'done' | 'error' | 'working'>('working')

  React.useEffect(() => {
    logout()
      .then(() => {
        afterSignOut()
        setState('done')
        router.refresh()
      })
      .catch(() => setState('error'))
    // Once, on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (state === 'working') return <p className="text-center text-[0.9375rem] text-ink-soft">Signing you out…</p>
  if (state === 'error') return <HouseAlert>That didn’t work. Please try again.</HouseAlert>
  return null
}
