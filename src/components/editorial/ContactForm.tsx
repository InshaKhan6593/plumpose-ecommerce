'use client'

import React, { useState } from 'react'

import { HouseAlert, HouseButton, HouseField as Field, houseInput as inputClass } from '@/components/forms/house'
import { cn } from '@/utilities/cn'

type State = 'idle' | 'sending' | 'done' | 'error'

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
        <HouseButton disabled={state === 'sending'} variant="outline">
          {state === 'sending' ? 'Sending…' : 'Send'}
        </HouseButton>
        {state === 'error' ? <HouseAlert>That didn’t send. Please try again, or write to us directly.</HouseAlert> : null}
      </div>
    </form>
  )
}
