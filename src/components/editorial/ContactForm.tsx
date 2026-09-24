'use client'

import React, { useState } from 'react'

import { cn } from '@/utilities/cn'

type State = 'idle' | 'sending' | 'done' | 'error'

/** Underlined single-line inputs, as the checkout uses. */
const inputClass =
  'w-full border-0 border-b border-line bg-transparent px-0 pt-2 pb-3 text-[0.9375rem] placeholder:text-ink-faint focus:border-ink focus:ring-0 focus-visible:outline-none'

/**
 * The contact page's enquiry form (REQUIREMENTS S12, A16). Posts to the
 * form-builder plugin's `form-submissions` collection, whose create is public
 * and whose read is admin-only — each message lands in the admin under
 * Content → Enquiries, and nothing a visitor sends can be read back out.
 *
 * `company` is a honeypot, as on the old site: hidden from people, filled by
 * bots, and a filled one is quietly dropped with the normal thank-you.
 */
export function ContactForm({
  formId,
  initialSubject,
  subjects,
  thanks,
}: {
  formId: number
  initialSubject?: string
  subjects: ReadonlyArray<string>
  thanks: { body: string; heading: string }
}) {
  const [state, setState] = useState<State>('idle')

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    if (String(data.get('company') ?? '')) {
      setState('done')
      return
    }

    const field = (name: string) => String(data.get(name) ?? '').trim()
    const submissionData = [
      { field: 'name', value: field('name') },
      { field: 'email', value: field('email') },
      { field: 'subject', value: field('subject') },
      { field: 'orderNumber', value: field('orderNumber') },
      { field: 'message', value: field('message') },
    ].filter((row) => row.value)

    setState('sending')
    try {
      const res = await fetch('/api/form-submissions', {
        body: JSON.stringify({ form: formId, submissionData }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      })
      setState(res.ok ? 'done' : 'error')
    } catch {
      setState('error')
    }
  }

  if (state === 'done') {
    return (
      <div aria-live="polite" className="border-t border-line pt-10">
        <p className="serif-display text-[2.5rem]">{thanks.heading}</p>
        <p className="mt-4 max-w-sm text-[0.9375rem] leading-relaxed text-ink-soft">{thanks.body}</p>
      </div>
    )
  }

  const matched = subjects.find((s) => s.toLowerCase() === initialSubject?.toLowerCase())

  return (
    <form className="grid gap-8 sm:grid-cols-2" onSubmit={submit}>
      <Field id="contact-name" label="Name">
        <input autoComplete="name" className={inputClass} id="contact-name" maxLength={120} name="name" required />
      </Field>
      <Field id="contact-email" label="Email">
        <input autoComplete="email" className={inputClass} id="contact-email" maxLength={200} name="email" required type="email" />
      </Field>
      <Field id="contact-subject" label="About">
        <select className={cn(inputClass, 'cursor-pointer')} defaultValue={matched ?? subjects[0]} id="contact-subject" name="subject">
          {subjects.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </Field>
      <Field id="contact-order" label="Order number (if any)">
        <input className={inputClass} id="contact-order" inputMode="numeric" maxLength={20} name="orderNumber" />
      </Field>
      <Field className="sm:col-span-2" id="contact-message" label="Message">
        <textarea className={cn(inputClass, 'min-h-36 resize-y')} id="contact-message" maxLength={3000} name="message" required />
      </Field>

      {/* Honeypot — see above. */}
      <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="contact-company">Leave blank</label>
        <input autoComplete="off" id="contact-company" name="company" tabIndex={-1} />
      </div>

      <div className="flex flex-wrap items-center gap-6 sm:col-span-2">
        <button
          className="caps inline-flex h-12 items-center border border-ink px-12 text-[0.6875rem] transition-colors hover:bg-ink hover:text-white disabled:opacity-40"
          disabled={state === 'sending'}
          type="submit"
        >
          {state === 'sending' ? 'Sending…' : 'Send'}
        </button>
        {state === 'error' ? (
          <p className="text-[0.8125rem] text-[#8a2424]" role="alert">
            That didn’t send. Please try again, or write to us directly.
          </p>
        ) : null}
      </div>
    </form>
  )
}

function Field({ children, className, id, label }: { children: React.ReactNode; className?: string; id: string; label: string }) {
  return (
    <div className={className}>
      <label className="caps block text-[0.5625rem] text-ink-soft" htmlFor={id}>
        {label}
      </label>
      {children}
    </div>
  )
}
