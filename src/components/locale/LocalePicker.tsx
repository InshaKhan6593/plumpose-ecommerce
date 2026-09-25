'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import React, { useEffect, useState } from 'react'

import { HouseButton, houseInput } from '@/components/forms/house'
import { BASE_CURRENCY } from '@/lib/pricing/currency'
import { useLenis } from '@/motion/MotionProvider'
import { type LocaleOptions, useLocale } from '@/providers/Locale'
import { cn } from '@/utilities/cn'

/**
 * Country and currency (docs/DESIGN-SPEC §6.18, the old site's "Where shall
 * we deliver?"). The country sets the currency; the currency can then be
 * changed on its own — an expatriate in Doha may want pounds. A country we
 * cannot deliver to says why, here, rather than at checkout; the visitor can
 * still browse in its currency.
 *
 * The words are the old site's own.
 */

/** A country code as its flag: two regional-indicator letters. */
const flag = (code: string) =>
  String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1a5 + c.charCodeAt(0)))

export function LocalePicker() {
  const { country, currency, loadOptions, pickerOpen, setLocale, setPickerOpen } = useLocale()
  const lenis = useLenis()
  const [options, setOptions] = useState<LocaleOptions | null>(null)
  const [countryCode, setCountryCode] = useState('QA')
  const [currencyCode, setCurrencyCode] = useState(BASE_CURRENCY)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!pickerOpen) {
      lenis.current?.start()
      return
    }
    lenis.current?.stop()
    setCountryCode(country?.code ?? 'QA')
    setCurrencyCode(currency?.code ?? BASE_CURRENCY)
    void loadOptions().then(setOptions)
  }, [country?.code, currency?.code, lenis, loadOptions, pickerOpen])

  const countries = options
    ? [...options.countries].sort(
        (a, b) => Number(b.code === 'QA') - Number(a.code === 'QA') || a.name.localeCompare(b.name),
      )
    : []
  const quotable = new Set([BASE_CURRENCY, ...(options?.currencies.map((c) => c.code) ?? [])])
  const chosen = countries.find((c) => c.code === countryCode)

  const pickCountry = (code: string) => {
    setCountryCode(code)
    // The country's own currency, when she can quote in it; otherwise riyals.
    const own = countries.find((c) => c.code === code)?.currencyCode
    setCurrencyCode(own && quotable.has(own) ? own : BASE_CURRENCY)
  }

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    await setLocale({
      country: chosen ? { code: chosen.code, name: chosen.name } : null,
      currencyCode,
    })
    setSaving(false)
    setPickerOpen(false)
  }

  return (
    <Dialog.Root onOpenChange={setPickerOpen} open={pickerOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/50 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content
          aria-describedby="locale-words"
          className="fixed top-1/2 left-1/2 z-50 max-h-[92svh] w-[calc(100vw-1.5rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto border border-line bg-paper-2 px-6 pt-10 pb-8 text-ink outline-none md:px-10"
          data-lenis-prevent
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            ;(event.currentTarget as HTMLElement | null)?.focus()
          }}
          tabIndex={-1}
        >
          <Dialog.Close
            aria-label="Close"
            className="absolute top-4 right-4 p-2 text-ink-soft transition-colors hover:text-ink"
          >
            <X className="size-5" strokeWidth={1.25} />
          </Dialog.Close>

          <p className="caps text-[0.625rem] text-ink-soft">Welcome to plumpose</p>
          <Dialog.Title className="serif-display mt-3 text-[2.25rem] leading-[1.05]">
            Where shall we deliver?
          </Dialog.Title>
          <p className="mt-4 text-[0.9375rem] leading-[1.7] text-ink-soft" id="locale-words">
            Tell us where you are. Everything will be shown in your own currency, with delivery to
            your door worked out before you pay.
          </p>

          {options ? (
            <form className="mt-8 flex flex-col gap-7" onSubmit={save}>
              <div>
                <label
                  className="caps block text-[0.5625rem] text-ink-soft"
                  htmlFor="locale-country"
                >
                  Your country
                </label>
                <select
                  className={cn(houseInput, 'cursor-pointer')}
                  id="locale-country"
                  onChange={(e) => pickCountry(e.target.value)}
                  value={countryCode}
                >
                  {countries.map((c) => (
                    <option key={c.code} value={c.code}>
                      {flag(c.code)} {c.name}
                    </option>
                  ))}
                </select>
                {chosen?.blockedReason ? (
                  <p className="mt-3 text-[0.8125rem] leading-relaxed text-[#8a2424]" role="status">
                    We cannot deliver to {chosen.name} at present —{' '}
                    {chosen.blockedReason.charAt(0).toLowerCase() + chosen.blockedReason.slice(1)}.
                    You can still browse.
                  </p>
                ) : null}
              </div>

              <div>
                <label
                  className="caps block text-[0.5625rem] text-ink-soft"
                  htmlFor="locale-currency"
                >
                  Show prices in
                </label>
                <select
                  className={cn(houseInput, 'cursor-pointer')}
                  id="locale-currency"
                  onChange={(e) => setCurrencyCode(e.target.value)}
                  value={currencyCode}
                >
                  <option value={BASE_CURRENCY}>QAR — Qatari Riyal</option>
                  {options.currencies
                    .filter((c) => c.code !== BASE_CURRENCY)
                    .map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code} — {c.name}
                      </option>
                    ))}
                </select>
                <p className="mt-3 text-[0.75rem] leading-relaxed text-ink-soft">
                  Every order is charged in Qatari Riyal. Other currencies are shown as a guide.
                </p>
              </div>

              <HouseButton className="w-full" disabled={saving}>
                {saving ? 'One moment…' : 'Continue'}
              </HouseButton>
              <p className="-mt-3 text-center text-[0.75rem] text-ink-soft">
                You can change this at any time from the top of the page.
              </p>
            </form>
          ) : (
            <p className="mt-8 text-[0.875rem] text-ink-soft">One moment…</p>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

/**
 * The control that opens it: "QAR" in the header, "Qatar · QAR" in the
 * footer. When she has switched currencies off, it is plain text again.
 */
export function LocaleButton({
  className,
  variant = 'code',
}: {
  className?: string
  variant?: 'code' | 'country'
}) {
  const { country, currency, enabled, openPicker } = useLocale()
  const code = currency?.code ?? BASE_CURRENCY
  const text = variant === 'country' ? `${country?.name ?? 'Qatar'} · ${code}` : code

  if (!enabled) return <span className={className}>{text}</span>
  return (
    <button
      aria-label={`Country and currency: ${country?.name ?? 'Qatar'}, ${code}. Change`}
      className={cn('transition-opacity hover:opacity-60', className)}
      onClick={openPicker}
      type="button"
    >
      {text}
    </button>
  )
}
