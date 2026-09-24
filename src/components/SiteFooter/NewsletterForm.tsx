'use client'

import React, { useState } from 'react'

type State = 'idle' | 'sending' | 'done' | 'error'

/**
 * Footer email signup (C14, S19). Writes straight to the Subscribers
 * collection, whose `create` is public and whose `read` is admin-only — so the
 * list of addresses never leaves the admin.
 */
export function NewsletterForm() {
  const [state, setState] = useState<State>('idle')
  const [message, setMessage] = useState('')

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const email = String(new FormData(form).get('email') ?? '').trim()
    if (!email) return

    setState('sending')
    try {
      const res = await fetch('/api/subscribers', {
        body: JSON.stringify({ email, source: 'footer' }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      })

      if (res.ok) {
        setState('done')
        setMessage('Thank you — you’re on the list.')
        form.reset()
        return
      }

      /**
       * Email is unique on the collection, so a repeat signup is a 400. It gets
       * the same thank-you as a new one: a different message would let anyone
       * test whether an address is on the list.
       */
      const body = (await res.json().catch(() => ({}))) as {
        errors?: Array<{ data?: { errors?: Array<{ path?: string }> } }>
      }
      const duplicate = body.errors?.some((e) => e.data?.errors?.some((f) => f.path === 'email'))
      setState(duplicate ? 'done' : 'error')
      setMessage(duplicate ? 'Thank you — you’re on the list.' : 'That didn’t work. Please try again.')
    } catch {
      setState('error')
      setMessage('That didn’t work. Please try again.')
    }
  }

  return (
    <form className="mt-8" noValidate={false} onSubmit={submit}>
      <label className="sr-only" htmlFor="footer-email">
        Your email
      </label>
      <div className="flex items-end gap-5">
        <input
          autoComplete="email"
          className="caps w-full max-w-60 border-0 border-b border-line bg-transparent px-0 pb-2 text-[0.625rem] placeholder:text-ink-soft focus:border-ink focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none"
          disabled={state === 'sending'}
          id="footer-email"
          name="email"
          placeholder="Your email"
          required
          type="email"
        />
        <button
          className="caps pb-2 text-[0.625rem] text-ink transition-opacity hover:opacity-60 disabled:opacity-40"
          disabled={state === 'sending'}
          type="submit"
        >
          {state === 'sending' ? 'Sending…' : 'Subscribe'}
        </button>
      </div>
      <p aria-live="polite" className="mt-3 min-h-5 text-xs text-ink-soft">
        {message}
      </p>
    </form>
  )
}
