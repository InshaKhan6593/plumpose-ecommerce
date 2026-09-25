import type { CollectionBeforeValidateHook } from 'payload'

import { ValidationError } from 'payload'

import type { Form } from '@/payload-types'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
/** Longest value kept for any one field. The Contact form's message caps at 3,000 in the browser. */
const MAX_VALUE = 5000

type Row = { field?: unknown; value?: unknown }

/**
 * Checks an enquiry against the form it was sent to, on the server.
 *
 * `form-submissions` is publicly writable (it is how the Contact page sends a
 * message), and the form-builder plugin validates nothing about the values —
 * its own source says the check belongs in a hook like this one. Without it a
 * message with only a name, or a thousand junk fields, was accepted.
 *
 * - only fields the form defines are kept, each once, trimmed and capped;
 * - every required field must be there and not blank;
 * - an email field must look like an email address.
 *
 * Admin edits in the panel skip the check: this is about what strangers send.
 */
export const validateEnquiry: CollectionBeforeValidateHook = async ({ data, operation, req }) => {
  if (operation !== 'create' || !data || req.user) return data

  const formID =
    typeof data.form === 'object' && data.form ? (data.form as { id: unknown }).id : data.form
  const form = (await req.payload
    .findByID({ collection: 'forms', depth: 0, id: formID as number, req })
    .catch(() => null)) as Form | null
  // The plugin's own field validation reports a missing form; nothing more to check here.
  if (!form) return data

  const defined = new Map(
    (form.fields ?? [])
      .filter((f): f is typeof f & { name: string } => 'name' in f && typeof f.name === 'string')
      .map((f) => [f.name, f]),
  )

  const values = new Map<string, string>()
  for (const row of (Array.isArray(data.submissionData) ? data.submissionData : []) as Row[]) {
    const name = typeof row.field === 'string' ? row.field : ''
    if (!defined.has(name) || values.has(name)) continue
    const value = String(row.value ?? '')
      .trim()
      .slice(0, MAX_VALUE)
    if (value) values.set(name, value)
  }

  const errors: Array<{ message: string; path: string }> = []
  for (const [name, field] of defined) {
    const value = values.get(name)
    if ('required' in field && field.required && !value) {
      errors.push({
        message: `${('label' in field && field.label) || name} is required.`,
        path: name,
      })
    } else if (value && field.blockType === 'email' && !EMAIL.test(value)) {
      errors.push({ message: 'Please check the email address.', path: name })
    }
  }
  if (errors.length) throw new ValidationError({ collection: 'form-submissions', errors }, req.t)

  return { ...data, submissionData: [...values].map(([field, value]) => ({ field, value })) }
}
