'use client'

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

import { BASE_CURRENCY, type DisplayCurrency, displayMinor } from '@/lib/pricing/currency'
import { formatQar, type Minor } from '@/lib/pricing/money'

/**
 * The visitor's country and display currency (REQUIREMENTS S7, C21).
 *
 * First visit: asks `/api/locale` where the request comes from and starts in
 * that country's currency — only if she allows it (Site settings → Currencies).
 * After that the choice is remembered on this browser, and the picker changes
 * it. Every page renders QAR on the server; the browser then shows the
 * visitor's currency, so prerendered pages stay prerendered.
 *
 * Display only. Checkout, orders and emails are in QAR, which is what is charged.
 */

export type LocaleOptions = {
  anchorQar: number
  countries: Array<{
    blockedReason: null | string
    code: string
    currencyCode: string
    name: string
  }>
  currencies: DisplayCurrency[]
  enabled: boolean
}

export type LocaleCountry = { code: string; name: string }
type Stored = { anchorQar: number; country: LocaleCountry | null; currency: DisplayCurrency | null }

type LocaleContext = {
  anchorQar: number
  /** The visitor's country, if known — checkout starts there. */
  country: LocaleCountry | null
  /** Null means QAR. */
  currency: DisplayCurrency | null
  enabled: boolean
  loadOptions: () => Promise<LocaleOptions | null>
  openPicker: () => void
  pickerOpen: boolean
  setPickerOpen: (open: boolean) => void
  setLocale: (args: { country: LocaleCountry | null; currencyCode: string }) => Promise<void>
}

const KEY = 'plumpose:locale'
/** Once per browsing session, the remembered currency is refreshed — she may have changed its price. */
const FRESH_KEY = 'plumpose:locale-fresh'

const read = <T,>(storage: 'local' | 'session', key: string): null | T => {
  try {
    const raw = (storage === 'local' ? window.localStorage : window.sessionStorage).getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}
const write = (storage: 'local' | 'session', key: string, value: unknown) => {
  try {
    ;(storage === 'local' ? window.localStorage : window.sessionStorage).setItem(
      key,
      JSON.stringify(value),
    )
  } catch {
    /* storage unavailable: the choice lasts for this page only */
  }
}

const Context = createContext<LocaleContext>({
  anchorQar: 1399,
  country: null,
  currency: null,
  enabled: false,
  loadOptions: async () => null,
  openPicker: () => undefined,
  pickerOpen: false,
  setLocale: async () => undefined,
  setPickerOpen: () => undefined,
})

let optionsPromise: null | Promise<LocaleOptions | null> = null
const fetchOptions = () =>
  (optionsPromise ??= fetch('/api/locale/options')
    .then((res) => (res.ok ? (res.json() as Promise<LocaleOptions>) : null))
    .catch(() => {
      optionsPromise = null
      return null
    }))

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<Stored & { enabled: boolean }>({
    anchorQar: 1399,
    country: null,
    currency: null,
    enabled: false,
  })
  const [pickerOpen, setPickerOpen] = useState(false)

  const apply = useCallback((next: Stored & { enabled: boolean }) => {
    setState(next)
    write('local', KEY, {
      anchorQar: next.anchorQar,
      country: next.country,
      currency: next.currency,
    })
  }, [])

  useEffect(() => {
    const stored = read<Stored>('local', KEY)

    if (stored) {
      // Straight away from memory, then quietly refreshed once a session.
      setState({ ...stored, enabled: true })
      if (read('session', FRESH_KEY)) return
      void fetchOptions().then((options) => {
        write('session', FRESH_KEY, true)
        if (!options) return
        const currency = stored.currency
          ? (options.currencies.find((c) => c.code === stored.currency?.code) ?? null)
          : null
        apply({
          anchorQar: options.anchorQar,
          country: stored.country,
          currency: options.enabled ? currency : null,
          enabled: options.enabled,
        })
      })
      return
    }

    // First visit: where are they?
    void fetch('/api/locale')
      .then((res) => res.json())
      .then(
        async (found: {
          anchorQar: number
          detected: { country: LocaleCountry | null; currencyCode: string }
          enabled: boolean
        }) => {
          const country = found.detected.country
            ? { code: found.detected.country.code, name: found.detected.country.name }
            : null
          let currency: DisplayCurrency | null = null
          if (found.enabled && found.detected.currencyCode !== BASE_CURRENCY) {
            currency =
              (await fetchOptions())?.currencies.find(
                (c) => c.code === found.detected.currencyCode,
              ) ?? null
          }
          write('session', FRESH_KEY, true)
          apply({ anchorQar: found.anchorQar, country, currency, enabled: found.enabled })
        },
      )
      .catch(() => undefined)
  }, [apply])

  const setLocale = useCallback<LocaleContext['setLocale']>(
    async ({ country, currencyCode }) => {
      const options = await fetchOptions()
      const currency =
        currencyCode === BASE_CURRENCY
          ? null
          : (options?.currencies.find((c) => c.code === currencyCode) ?? null)
      apply({
        anchorQar: options?.anchorQar ?? state.anchorQar,
        country,
        currency,
        enabled: options?.enabled ?? state.enabled,
      })
    },
    [apply, state.anchorQar, state.enabled],
  )

  const value = useMemo<LocaleContext>(
    () => ({
      ...state,
      // Switched off in her settings: everyone sees QAR.
      currency: state.enabled ? state.currency : null,
      loadOptions: fetchOptions,
      openPicker: () => setPickerOpen(true),
      pickerOpen,
      setLocale,
      setPickerOpen,
    }),
    [pickerOpen, setLocale, state],
  )

  return <Context.Provider value={value}>{children}</Context.Provider>
}

export const useLocale = () => useContext(Context)

/** Formats QAR amounts (minor units) for this visitor. */
export const useMoney = () => {
  const { anchorQar, currency } = useLocale()
  return useCallback(
    (minor: Minor) => displayMinor(minor, currency, anchorQar),
    [anchorQar, currency],
  )
}

/**
 * A price for the visitor: their currency when they have chosen one, QAR
 * otherwise. The server renders QAR; the browser swaps in the local figure.
 */
export function Money({ className, minor }: { className?: string; minor: Minor }) {
  const format = useMoney()
  const { currency } = useLocale()
  return (
    <span className={className} title={currency ? `Charged as ${formatQar(minor)}` : undefined}>
      {format(minor)}
    </span>
  )
}

/** "Charged in QAR 1,399.00" — shown beside a converted figure, never alone. */
export function ChargedInQar({ className, minor }: { className?: string; minor: Minor }) {
  const { currency } = useLocale()
  if (!currency) return null
  return <span className={className}>Charged in {formatQar(minor)}</span>
}
