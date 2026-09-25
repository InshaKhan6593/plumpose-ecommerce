'use client'

import React, { useEffect, useState } from 'react'

import { HouseAlert, HouseButton, HouseField, houseInput } from '@/components/forms/house'

type Errors = Partial<Record<'consent' | 'email' | 'file' | 'handle' | 'postUrl', string>>

const MAX_MB = 12

/**
 * "Send us yours" on the Spotted page (REQUIREMENTS S15). Posts the photo to
 * /api/spotted/submit, which checks everything again; every photograph waits
 * for her approval before it appears.
 */
export function SpottedForm() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<null | string>(null)
  const [errors, setErrors] = useState<Errors>({})
  const [failure, setFailure] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  useEffect(() => {
    if (!file) return setPreview(null)
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  if (sent) {
    return (
      <HouseAlert tone="note">
        Thank you — your photograph has reached us. Once we have seen it, it may appear here.
      </HouseAlert>
    )
  }

  const pick = (event: React.ChangeEvent<HTMLInputElement>) => {
    const chosen = event.target.files?.[0] ?? null
    setErrors((e) => ({ ...e, file: undefined }))
    if (chosen && chosen.size > MAX_MB * 1024 * 1024) {
      setErrors((e) => ({
        ...e,
        file: `That photograph is over ${MAX_MB} MB — please send a smaller one.`,
      }))
      setFile(null)
      return
    }
    setFile(chosen)
  }

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const local: Errors = {}
    if (!file) local.file = 'Please choose a photograph.'
    if (!String(form.get('handle') ?? '').trim())
      local.handle = 'Please add your Instagram name, like @yourname.'
    if (form.get('consent') !== 'on') local.consent = 'Please confirm we may share your photograph.'
    setErrors(local)
    setFailure('')
    if (Object.keys(local).length || !file) return

    const body = new FormData()
    body.append('file', file)
    body.append(
      '_payload',
      JSON.stringify({
        caption: form.get('caption'),
        consent: true,
        email: form.get('email'),
        handle: form.get('handle'),
        postUrl: form.get('postUrl'),
      }),
    )

    setSending(true)
    try {
      const res = await fetch('/api/spotted/submit', { body, credentials: 'omit', method: 'POST' })
      if (res.ok) return setSent(true)
      const json = (await res.json().catch(() => null)) as null | { errors?: Errors }
      if (json?.errors && Object.keys(json.errors).length) setErrors(json.errors)
      else setFailure('That didn’t send. Please try again in a moment.')
    } catch {
      setFailure('That didn’t send. Please check your connection and try again.')
    } finally {
      setSending(false)
    }
  }

  return (
    <form
      className="grid gap-10 md:grid-cols-[minmax(0,16rem)_minmax(0,1fr)] md:gap-14"
      noValidate
      onSubmit={submit}
    >
      <div>
        <label className="group relative flex aspect-[4/5] cursor-pointer items-center justify-center overflow-hidden border border-dashed border-line bg-paper-3 text-center transition-colors hover:border-ink">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt="Your photograph"
              className="absolute inset-0 h-full w-full object-cover"
              src={preview}
            />
          ) : (
            <span className="caps px-6 text-[0.5625rem] leading-relaxed text-ink-soft">
              Choose a photograph
            </span>
          )}
          <input
            accept="image/jpeg,image/png,image/webp"
            aria-label="Your photograph"
            className="sr-only"
            name="file"
            onChange={pick}
            type="file"
          />
        </label>
        <p className="mt-3 text-[0.75rem] text-ink-soft">
          {errors.file ? (
            <span className="text-[#8a2424]">{errors.file}</span>
          ) : (
            `JPEG, PNG or WebP, up to ${MAX_MB} MB.`
          )}
        </p>
      </div>

      <div className="flex flex-col gap-7">
        <div className="grid gap-7 sm:grid-cols-2">
          <HouseField error={errors.handle} id="spotted-handle" label="Your Instagram">
            <input
              aria-invalid={Boolean(errors.handle)}
              autoCapitalize="none"
              className={houseInput}
              id="spotted-handle"
              maxLength={31}
              name="handle"
              placeholder="@yourname"
            />
          </HouseField>
          <HouseField
            error={errors.email}
            hint="Optional. Never shown."
            id="spotted-email"
            label="Email"
          >
            <input
              aria-invalid={Boolean(errors.email)}
              autoComplete="email"
              className={houseInput}
              id="spotted-email"
              name="email"
              type="email"
            />
          </HouseField>
        </div>
        <HouseField id="spotted-caption" label="A line to go with it (optional)">
          <input className={houseInput} id="spotted-caption" maxLength={200} name="caption" />
        </HouseField>
        <HouseField
          error={errors.postUrl}
          hint="Optional — if it is on Instagram, the link to the post."
          id="spotted-post"
          label="Link to your post"
        >
          <input
            aria-invalid={Boolean(errors.postUrl)}
            className={houseInput}
            id="spotted-post"
            name="postUrl"
            placeholder="https://instagram.com/p/…"
            type="url"
          />
        </HouseField>

        <label className="flex items-start gap-3 text-[0.8125rem] leading-relaxed text-ink-soft">
          <input
            className="mt-1 size-4 accent-[var(--color-ink,#1a1714)]"
            name="consent"
            type="checkbox"
          />
          <span>
            The photograph is mine, and plumpose may share it on this site with my Instagram name.
            {errors.consent ? (
              <span className="mt-1 block text-[#8a2424]">{errors.consent}</span>
            ) : null}
          </span>
        </label>

        {failure ? <HouseAlert>{failure}</HouseAlert> : null}

        <div className="flex flex-wrap items-center gap-6">
          <HouseButton disabled={sending}>{sending ? 'Sending…' : 'Send photograph'}</HouseButton>
          <p className="text-[0.75rem] text-ink-soft">
            We look at every photograph before it appears.
          </p>
        </div>
      </div>
    </form>
  )
}
