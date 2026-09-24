'use client'

import { useCart, usePayments } from '@payloadcms/plugin-ecommerce/client/react'
import { ChevronDown, Lock } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import React, { useEffect, useMemo, useRef, useState } from 'react'

import type { Media, Product, Variant, VariantOption } from '@/payload-types'

import { formatQar } from '@/lib/pricing/money'
import { useAuth } from '@/providers/Auth'
import { cn } from '@/utilities/cn'

/**
 * Checkout (docs/SCREEN-PROMPTS.md 09): contact, delivery, gift, discount on
 * the left; the order, priced live, on the right.
 *
 * **Every figure comes from `/api/quote`** — the engine payment charges
 * through — never from the cart's own subtotal, which is goods only.
 *
 * Payment is taken on Stripe's hosted page: "Pay" asks the server to price the
 * bag again and open a Checkout Session, then the browser goes there. That is
 * SkipCash's shape too (it returns a `payUrl`), so this page survives the
 * gateway change untouched. What was typed is kept in sessionStorage, so
 * coming back from a cancelled payment does not mean typing it all again.
 */

export type CheckoutCountry = { blockedReason: null | string; code: string; name: string }
export type CheckoutCity = { feeQar: number; key: string; name: string }
/** A signed-in customer's most recent saved address, already in the form's shape. */
export type CheckoutSavedAddress = Partial<
  Pick<Form, 'addressLine1' | 'addressLine2' | 'city' | 'cityKey' | 'country' | 'firstName' | 'lastName' | 'phone' | 'postalCode'>
>

type QuoteLine = {
  personalisation: Array<{ lettering: string; placementName: string; symbolName: string; threadName: string }>
  personalisationTotal: number
  subtotal: number
}

type Quote = {
  deliveryPending?: boolean
  discountError?: null | string
  lines: QuoteLine[]
  totals: {
    discount?: number
    discountCode?: string
    freeShippingApplied?: boolean
    personalisation: number
    shipping?: number
    shippingLabel?: string
    subtotal: number
    total: number
  }
}

type QuoteState =
  | { quote: Quote; status: 'ok' }
  | { error: string; status: 'refused' }
  | { status: 'idle' | 'loading' }

type Form = {
  addressLine1: string
  addressLine2: string
  city: string
  cityKey: string
  country: string
  email: string
  firstName: string
  gift: boolean
  giftNote: string
  lastName: string
  phone: string
  postalCode: string
}

type FieldName = keyof Form

const QATAR = 'QA'
const GIFT_NOTE_MAX = 300
/** Where the checkout draft lives in sessionStorage. ClearBag removes it after payment. */
export const CHECKOUT_DRAFT_KEY = 'plumpose:checkout'

const EMPTY: Form = {
  addressLine1: '',
  addressLine2: '',
  city: '',
  cityKey: '',
  country: QATAR,
  email: '',
  firstName: '',
  gift: false,
  giftNote: '',
  lastName: '',
  phone: '',
  postalCode: '',
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

const describe = (p: QuoteLine['personalisation'][number]) =>
  `${p.placementName}: ${[
    p.lettering ? `“${p.lettering}”` : '',
    p.symbolName ? p.symbolName.toLowerCase() : '',
    p.threadName ? `${p.threadName.toLowerCase()} thread` : '',
  ]
    .filter(Boolean)
    .join(', ')}`

/** Reads a stored draft; storage can be unavailable (private windows, blocked site data). */
const loadDraft = (): Partial<Form> => {
  try {
    const raw = window.sessionStorage.getItem(CHECKOUT_DRAFT_KEY)
    return raw ? (JSON.parse(raw) as Partial<Form>) : {}
  } catch {
    return {}
  }
}

const inputClass =
  'w-full border-0 border-b border-line bg-transparent px-0 py-2 text-[0.9375rem] text-ink placeholder:text-ink-faint transition-colors focus:border-ink focus:outline-none focus:ring-0 aria-[invalid=true]:border-[#8a2424]'

export function CheckoutPage({
  cancelled,
  cities,
  countries,
  saved,
  testMode,
}: {
  cancelled: boolean
  cities: CheckoutCity[]
  countries: CheckoutCountry[]
  saved?: CheckoutSavedAddress
  testMode: boolean
}) {
  const { user } = useAuth()
  const { cart, isLoading: cartLoading } = useCart()
  const { initiatePayment, paymentMethods } = usePayments()

  const [form, setForm] = useState<Form>(EMPTY)
  const [restored, setRestored] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({})
  const [codeInput, setCodeInput] = useState('')
  const [appliedCode, setAppliedCode] = useState('')
  const [quoteState, setQuoteState] = useState<QuoteState>({ status: 'idle' })
  const [submitting, setSubmitting] = useState(false)
  const [payError, setPayError] = useState<null | string>(null)
  const formRef = useRef<HTMLFormElement>(null)

  const items = useMemo(() => cart?.items ?? [], [cart])
  const stripeReady = paymentMethods.some((m) => m.name === 'stripe')

  /* ---------- draft: restore once, then keep ---------- */
  /*
   * A signed-in customer's saved address fills the blanks; anything already
   * typed in this visit (the draft) wins, field by field. Empty draft values
   * are skipped, so a draft saved before the address was typed cannot blank
   * the saved one out.
   */
  useEffect(() => {
    const draft = Object.fromEntries(Object.entries(loadDraft()).filter(([, v]) => v !== '')) as Partial<Form>
    setForm((f) => ({ ...f, ...saved, ...draft }))
    setRestored(true)
    // Once, on arrival: `saved` comes from the server and does not change on this page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!restored) return
    try {
      window.sessionStorage.setItem(CHECKOUT_DRAFT_KEY, JSON.stringify(form))
    } catch {
      /* storage unavailable — the form still works, it just will not survive a reload */
    }
  }, [form, restored])

  const set = <K extends FieldName>(key: K, value: Form[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }))
  }

  const country = countries.find((c) => c.code === form.country)
  const inQatar = form.country === QATAR
  const blocked = country?.blockedReason ?? null
  const email = user?.email ?? form.email.trim()
  const emailValid = EMAIL.test(email)

  /* ---------- live price ---------- */
  const itemsKey = JSON.stringify(
    items.map((item) => [
      typeof item.product === 'object' ? item.product?.id : item.product,
      typeof item.variant === 'object' ? item.variant?.id : item.variant,
      item.quantity,
      (item as { personalisation?: unknown }).personalisation ?? [],
    ]),
  )

  // Qatar without a city cannot be priced yet: ask for goods only until one is chosen.
  const destinationReady = Boolean(form.country) && !blocked && (!inQatar || Boolean(form.cityKey))

  useEffect(() => {
    if (!items.length) {
      setQuoteState({ status: 'idle' })
      return
    }
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setQuoteState((s) => (s.status === 'ok' ? s : { status: 'loading' }))
      fetch('/api/quote', {
        body: JSON.stringify({
          ...(destinationReady ? { city: inQatar ? form.cityKey : undefined, country: form.country } : {}),
          discountCode: appliedCode || undefined,
          email: emailValid ? email : undefined,
          items: items.map((item) => ({
            personalisation: (item as { personalisation?: unknown }).personalisation ?? [],
            productId: typeof item.product === 'object' ? item.product?.id : item.product,
            quantity: item.quantity,
            variantId: typeof item.variant === 'object' ? item.variant?.id : item.variant,
          })),
        }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
        signal: controller.signal,
      })
        .then(async (res) => {
          const body = await res.json().catch(() => ({}))
          if (res.ok) setQuoteState({ quote: body as Quote, status: 'ok' })
          else setQuoteState({ error: (body as { error?: string }).error || 'This bag cannot be priced.', status: 'refused' })
        })
        .catch((error: unknown) => {
          if ((error as { name?: string })?.name !== 'AbortError') {
            setQuoteState({ error: 'Prices could not be loaded. Check your connection.', status: 'refused' })
          }
        })
    }, 250)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsKey, destinationReady, form.country, form.cityKey, appliedCode, emailValid ? email : ''])

  const quote = quoteState.status === 'ok' ? quoteState.quote : null
  const lineQuotes = quote && quote.lines.length === items.length ? quote.lines : null
  const discountRejected = quote?.discountError && appliedCode ? quote.discountError : null
  const hasEmbroidery = Boolean(quote && quote.totals.personalisation > 0)

  /* ---------- validation ---------- */
  const validate = (): Partial<Record<FieldName, string>> => {
    const next: Partial<Record<FieldName, string>> = {}
    if (!user && !EMAIL.test(form.email.trim())) next.email = 'Enter the email address for your receipt.'
    if (!form.firstName.trim()) next.firstName = 'Enter your first name.'
    if (!form.lastName.trim()) next.lastName = 'Enter your last name.'
    if (form.phone.replace(/\D/g, '').length < 7) next.phone = 'Enter a phone number the courier can call.'
    if (!form.country) next.country = 'Choose where this is going.'
    if (inQatar && !form.cityKey) next.cityKey = 'Choose your city.'
    if (!inQatar && !form.city.trim()) next.city = 'Enter your city.'
    if (!form.addressLine1.trim()) next.addressLine1 = 'Enter the street and building.'
    return next
  }

  const pay = async (event: React.FormEvent) => {
    event.preventDefault()
    setPayError(null)

    const found = validate()
    setErrors(found)
    const first = Object.keys(found)[0]
    if (first) {
      formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus()
      return
    }
    if (blocked || quoteState.status !== 'ok' || !destinationReady) return

    const cityName = inQatar ? (cities.find((c) => c.key === form.cityKey)?.name ?? '') : form.city.trim()
    const address = {
      addressLine1: form.addressLine1.trim(),
      addressLine2: form.addressLine2.trim(),
      city: cityName,
      country: form.country,
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      phone: form.phone.trim(),
      postalCode: inQatar ? '' : form.postalCode.trim(),
    }

    setSubmitting(true)
    try {
      const result = (await initiatePayment('stripe', {
        additionalData: {
          ...(user ? {} : { customerEmail: form.email.trim() }),
          billingAddress: address,
          discountCode: appliedCode || null,
          gift: form.gift,
          giftNote: form.gift ? form.giftNote.trim() : '',
          shippingAddress: address,
          shippingCityKey: inQatar ? form.cityKey : null,
        },
      })) as { redirectURL?: string }

      if (!result?.redirectURL) throw new Error('No payment page')
      window.location.assign(result.redirectURL)
    } catch (error) {
      const text = error instanceof Error ? error.message : ''
      setPayError(
        /OutOfStock|out of stock/i.test(text)
          ? 'One of your pieces has just sold out in that size. Please review your bag.'
          : 'The payment page could not be opened. Nothing was charged — please try again.',
      )
      setSubmitting(false)
    }
  }

  /* ---------- empty / unavailable ---------- */
  if (!cartLoading && !items.length) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-6 py-24 text-center">
        <h1 className="serif-display text-[clamp(2.25rem,4vw,3.25rem)] leading-tight">Your bag is empty.</h1>
        <p className="mt-4 text-ink-soft">Every piece is hand-finished to order in Doha.</p>
        <Link className="caps mt-10 bg-ink px-10 py-4 text-[0.6875rem] text-white hover:bg-ink/85" href="/shop">
          Visit the shop
        </Link>
      </div>
    )
  }

  const deliveryValue = !form.country
    ? 'Choose a destination'
    : blocked
      ? 'Unavailable'
      : inQatar && !form.cityKey
        ? 'Choose your city'
        : quote && !quote.deliveryPending && typeof quote.totals.shipping === 'number'
          ? quote.totals.freeShippingApplied
            ? 'Free'
            : formatQar(quote.totals.shipping)
          : '—'

  const canPay = stripeReady && !submitting && !blocked && destinationReady && quoteState.status === 'ok'

  return (
    <div className="mx-auto max-w-[90rem] px-4 pt-10 pb-24 md:px-7 md:pt-14">
      <h1 className="serif-display text-[clamp(2.5rem,4.5vw,3.75rem)] leading-none">Checkout</h1>

      {cancelled ? (
        <p className="mt-6 max-w-2xl border-l border-ink pl-4 text-[0.9375rem] text-ink-soft" role="status">
          Payment cancelled — nothing was charged. Your bag and details are just as you left them.
        </p>
      ) : null}
      {!stripeReady ? (
        <p className="mt-6 max-w-2xl border-l border-[#8a2424] pl-4 text-[0.9375rem] text-ink-soft" role="alert">
          Payments are not switched on for this site yet.
        </p>
      ) : null}

      <div className="mt-10 grid gap-14 lg:mt-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,27rem)] lg:gap-20 xl:gap-28">
        <form className="flex flex-col gap-14" id="checkout-form" noValidate onSubmit={pay} ref={formRef}>
          {/* 01 — Contact */}
          <Section n="01" title="Contact">
            {user ? (
              <p className="text-[0.9375rem]">
                Signed in as <span className="text-ink">{user.email}</span>
              </p>
            ) : (
              <>
                <Field error={errors.email} id="email" label="Email">
                  <input
                    aria-describedby={errors.email ? 'email-error' : 'email-hint'}
                    aria-invalid={Boolean(errors.email)}
                    autoComplete="email"
                    className={inputClass}
                    id="email"
                    inputMode="email"
                    name="email"
                    onChange={(e) => set('email', e.target.value)}
                    type="email"
                    value={form.email}
                  />
                </Field>
                <p className="mt-3 text-xs text-ink-soft" id="email-hint">
                  Your receipt and updates on your order go here. No account needed.{' '}
                  <Link className="underline underline-offset-4 hover:text-ink" href="/login?redirect=/checkout">
                    Sign in
                  </Link>
                </p>
              </>
            )}
          </Section>

          {/* 02 — Delivery */}
          <Section n="02" title="Delivery">
            <div className="grid gap-x-8 gap-y-7 sm:grid-cols-2">
              <Field className="sm:col-span-2" error={errors.country} id="country" label="Country">
                <SelectBox>
                  <select
                    aria-describedby={blocked ? 'country-blocked' : undefined}
                    aria-invalid={Boolean(errors.country || blocked)}
                    autoComplete="country"
                    className={cn(inputClass, 'appearance-none pr-8')}
                    id="country"
                    name="country"
                    onChange={(e) => {
                      set('country', e.target.value)
                      set('cityKey', '')
                    }}
                    value={form.country}
                  >
                    {countries.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name}
                        {c.blockedReason ? ' — unavailable' : ''}
                      </option>
                    ))}
                  </select>
                </SelectBox>
                {blocked ? (
                  <p className="mt-3 text-[0.8125rem] leading-relaxed text-[#8a2424]" id="country-blocked" role="alert">
                    We cannot deliver to {country?.name}. {blocked}
                  </p>
                ) : null}
              </Field>

              <Field error={errors.firstName} id="firstName" label="First name">
                <input
                  aria-invalid={Boolean(errors.firstName)}
                  autoComplete="given-name"
                  className={inputClass}
                  id="firstName"
                  name="firstName"
                  onChange={(e) => set('firstName', e.target.value)}
                  value={form.firstName}
                />
              </Field>
              <Field error={errors.lastName} id="lastName" label="Last name">
                <input
                  aria-invalid={Boolean(errors.lastName)}
                  autoComplete="family-name"
                  className={inputClass}
                  id="lastName"
                  name="lastName"
                  onChange={(e) => set('lastName', e.target.value)}
                  value={form.lastName}
                />
              </Field>

              {inQatar ? (
                <Field className="sm:col-span-2" error={errors.cityKey} id="cityKey" label="City">
                  <SelectBox>
                    <select
                      aria-invalid={Boolean(errors.cityKey)}
                      className={cn(inputClass, 'appearance-none pr-8', !form.cityKey && 'text-ink-faint')}
                      id="cityKey"
                      name="cityKey"
                      onChange={(e) => set('cityKey', e.target.value)}
                      value={form.cityKey}
                    >
                      <option disabled value="">
                        Choose your city
                      </option>
                      {cities.map((c) => (
                        <option className="text-ink" key={c.key} value={c.key}>
                          {c.name} — QAR {c.feeQar}
                        </option>
                      ))}
                    </select>
                  </SelectBox>
                </Field>
              ) : null}

              <Field className="sm:col-span-2" error={errors.addressLine1} id="addressLine1" label="Street and building">
                <input
                  aria-invalid={Boolean(errors.addressLine1)}
                  autoComplete="address-line1"
                  className={inputClass}
                  id="addressLine1"
                  name="addressLine1"
                  onChange={(e) => set('addressLine1', e.target.value)}
                  placeholder={inQatar ? 'Building no., street no.' : undefined}
                  value={form.addressLine1}
                />
              </Field>
              <Field className="sm:col-span-2" id="addressLine2" label={inQatar ? 'Zone, apartment (optional)' : 'Apartment, area (optional)'}>
                <input
                  autoComplete="address-line2"
                  className={inputClass}
                  id="addressLine2"
                  name="addressLine2"
                  onChange={(e) => set('addressLine2', e.target.value)}
                  value={form.addressLine2}
                />
              </Field>

              {!inQatar ? (
                <>
                  <Field error={errors.city} id="city" label="City">
                    <input
                      aria-invalid={Boolean(errors.city)}
                      autoComplete="address-level2"
                      className={inputClass}
                      id="city"
                      name="city"
                      onChange={(e) => set('city', e.target.value)}
                      value={form.city}
                    />
                  </Field>
                  <Field id="postalCode" label="Postcode (if any)">
                    <input
                      autoComplete="postal-code"
                      className={inputClass}
                      id="postalCode"
                      name="postalCode"
                      onChange={(e) => set('postalCode', e.target.value)}
                      value={form.postalCode}
                    />
                  </Field>
                </>
              ) : null}

              <Field className="sm:col-span-2" error={errors.phone} id="phone" label="Phone">
                <input
                  aria-invalid={Boolean(errors.phone)}
                  autoComplete="tel"
                  className={inputClass}
                  id="phone"
                  inputMode="tel"
                  name="phone"
                  onChange={(e) => set('phone', e.target.value)}
                  placeholder={inQatar ? '+974' : undefined}
                  type="tel"
                  value={form.phone}
                />
              </Field>
            </div>
          </Section>

          {/* 03 — Gift */}
          <Section n="03" title="A gift?">
            <label className="flex cursor-pointer items-start gap-4">
              <input
                checked={form.gift}
                className="mt-1 size-4 shrink-0 accent-ink"
                name="gift"
                onChange={(e) => set('gift', e.target.checked)}
                type="checkbox"
              />
              <span className="text-[0.9375rem] leading-relaxed">
                This is a gift
                <span className="block text-[0.8125rem] text-ink-soft">
                  We add a handwritten card and leave the prices out of the parcel.
                </span>
              </span>
            </label>
            {form.gift ? (
              <Field className="mt-7" id="giftNote" label="Your message">
                <textarea
                  aria-describedby="giftNote-count"
                  className={cn(inputClass, 'min-h-24 resize-y')}
                  id="giftNote"
                  maxLength={GIFT_NOTE_MAX}
                  name="giftNote"
                  onChange={(e) => set('giftNote', e.target.value)}
                  rows={3}
                  value={form.giftNote}
                />
                <p className="mt-2 text-right text-[0.6875rem] text-ink-soft tabular-nums" id="giftNote-count">
                  {form.giftNote.length} / {GIFT_NOTE_MAX}
                </p>
              </Field>
            ) : null}
          </Section>

          {/* 04 — Discount */}
          <Section n="04" title="Discount code">
            <div className="flex items-end gap-6">
              <Field className="flex-1" id="discountCode" label="Code">
                <input
                  autoCapitalize="characters"
                  className={cn(inputClass, 'uppercase')}
                  id="discountCode"
                  name="discountCode"
                  onChange={(e) => setCodeInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      setAppliedCode(codeInput.trim().toUpperCase())
                    }
                  }}
                  value={codeInput}
                />
              </Field>
              {appliedCode && !discountRejected ? (
                <button
                  className="caps pb-2.5 text-[0.625rem] text-ink-soft underline-offset-4 hover:text-ink hover:underline"
                  onClick={() => {
                    setAppliedCode('')
                    setCodeInput('')
                  }}
                  type="button"
                >
                  Remove
                </button>
              ) : (
                <button
                  className="caps pb-2.5 text-[0.625rem] underline-offset-4 hover:underline disabled:opacity-40"
                  disabled={!codeInput.trim()}
                  onClick={() => setAppliedCode(codeInput.trim().toUpperCase())}
                  type="button"
                >
                  Apply
                </button>
              )}
            </div>
            <p aria-live="polite" className="mt-3 min-h-5 text-[0.8125rem]">
              {discountRejected ? (
                <span className="text-[#8a2424]">{discountRejected}</span>
              ) : appliedCode && quote?.deliveryPending ? (
                <span className="text-ink-soft">{appliedCode} will be checked once you choose where it is going.</span>
              ) : appliedCode && quote?.totals.discountCode ? (
                <span className="text-ink-soft">
                  {quote.totals.discountCode} applied
                  {quote.totals.discount ? ` — ${formatQar(quote.totals.discount)} off` : ''}.
                </span>
              ) : null}
            </p>
          </Section>
        </form>

        {/* The order */}
        <aside className="lg:sticky lg:top-28 lg:self-start">
          <div className="bg-paper-3 px-6 py-8 md:px-8">
            <h2 className="caps text-[0.6875rem]">Your order</h2>

            <ul className="mt-6 flex flex-col">
              {items.map((item, index) => {
                const product = typeof item.product === 'object' ? (item.product as Product) : null
                if (!product) return null
                const variant = typeof item.variant === 'object' ? (item.variant as Variant) : null
                const size = variant?.options
                  ?.map((o) => (typeof o === 'object' ? (o as VariantOption).label : null))
                  .filter(Boolean)
                  .join(' / ')
                const image = product.gallery?.find((g) => typeof g.image === 'object')?.image as Media | undefined
                const line = lineQuotes?.[index]
                const unit = variant?.priceInQAR ?? product.priceInQAR ?? 0
                const lineTotal = line ? line.subtotal + line.personalisationTotal : unit * (item.quantity || 1)

                return (
                  <li className="flex gap-4 border-b border-line py-5 first:pt-0" key={item.id ?? index}>
                    <div className="relative aspect-[4/5] w-16 shrink-0 overflow-hidden bg-background">
                      {image?.url ? (
                        <Image alt={image.alt || product.title} className="object-cover" fill sizes="64px" src={image.url} />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="serif-display text-[1.0625rem] leading-snug">{product.title.split(/\s+[—–]\s+/)[0]}</p>
                        <span className="shrink-0 text-sm tabular-nums">{formatQar(lineTotal)}</span>
                      </div>
                      <p className="mt-1 text-xs text-ink-soft">
                        {size ? `Size ${size} · ` : ''}Qty {item.quantity}
                      </p>
                      {line?.personalisation.map((p) => (
                        <p className="serif-italic mt-1 text-[0.8125rem] text-ink-soft" key={p.placementName}>
                          Embroidery — {describe(p)}
                        </p>
                      ))}
                    </div>
                  </li>
                )
              })}
            </ul>

            <dl className="mt-6 flex flex-col gap-2.5 text-sm" aria-busy={quoteState.status === 'loading'}>
              <Row label="Pieces" value={quote ? formatQar(quote.totals.subtotal) : '—'} />
              {hasEmbroidery && quote ? <Row label="Embroidery" value={formatQar(quote.totals.personalisation)} /> : null}
              <Row
                label={quote?.totals.shippingLabel && !quote.deliveryPending ? quote.totals.shippingLabel : 'Delivery'}
                muted={!quote || Boolean(quote.deliveryPending)}
                value={deliveryValue}
              />
              {quote?.totals.discount ? <Row label="Discount" value={`− ${formatQar(quote.totals.discount)}`} /> : null}
              <div className="mt-3 flex items-baseline justify-between border-t border-line pt-4">
                <dt className="caps text-[0.6875rem]">Total</dt>
                <dd className="text-lg tabular-nums">
                  {quote && !quote.deliveryPending ? formatQar(quote.totals.total) : '—'}
                </dd>
              </div>
            </dl>

            {quoteState.status === 'refused' && !blocked ? (
              <p className="mt-4 text-[0.8125rem] text-[#8a2424]" role="alert">
                {quoteState.error}
              </p>
            ) : null}

            <p className="mt-4 text-xs leading-relaxed text-ink-soft">
              Charged in Qatari riyal (QAR).
              {hasEmbroidery ? ' Hand-embroidered pieces are made for you and cannot be returned.' : ''}
            </p>

            <button
              className={cn(
                'caps mt-7 flex h-13 w-full items-center justify-center gap-2 bg-ink px-6 py-4 text-[0.6875rem] text-white transition-colors hover:bg-ink/85',
                !canPay && 'cursor-not-allowed bg-ink/40 hover:bg-ink/40',
              )}
              disabled={!canPay}
              form="checkout-form"
              type="submit"
            >
              <Lock aria-hidden className="size-3.5" strokeWidth={1.5} />
              {submitting
                ? 'Opening secure payment…'
                : quote && !quote.deliveryPending
                  ? `Pay ${formatQar(quote.totals.total)}`
                  : 'Pay securely'}
            </button>

            {payError ? (
              <p className="mt-4 text-[0.8125rem] text-[#8a2424]" role="alert">
                {payError}
              </p>
            ) : null}

            <p className="mt-4 text-center text-xs leading-relaxed text-ink-soft">
              You will pay on Stripe’s secure page, then come straight back here.
            </p>
            {testMode ? (
              <p className="mt-3 border border-line px-3 py-2 text-center text-[0.6875rem] leading-relaxed text-ink-soft">
                Test mode — use card 4242 4242 4242 4242, any future date, any CVC. No money moves.
              </p>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  )
}

function Section({ children, n, title }: { children: React.ReactNode; n: string; title: string }) {
  const id = `section-${n}`
  return (
    <section aria-labelledby={id} className="border-t border-line pt-8">
      <h2 className="flex items-baseline gap-4" id={id}>
        <span className="caps text-[0.625rem] text-ink-soft tabular-nums">{n}</span>
        <span className="serif-display text-[1.625rem] leading-none">{title}</span>
      </h2>
      <div className="mt-7">{children}</div>
    </section>
  )
}

function Field({
  children,
  className,
  error,
  id,
  label,
}: {
  children: React.ReactNode
  className?: string
  error?: string
  id: string
  label: string
}) {
  return (
    <div className={className}>
      <label className="caps block text-[0.5625rem] text-ink-soft" htmlFor={id}>
        {label}
      </label>
      {children}
      {error ? (
        <p className="mt-2 text-[0.8125rem] text-[#8a2424]" id={`${id}-error`}>
          {error}
        </p>
      ) : null}
    </div>
  )
}

function SelectBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      {children}
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-0 size-4 -translate-y-1/2 text-ink-soft"
        strokeWidth={1.25}
      />
    </div>
  )
}

function Row({ label, muted, value }: { label: string; muted?: boolean; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="caps text-[0.625rem] text-ink-soft">{label}</dt>
      <dd className={cn('text-right tabular-nums', muted && 'text-xs text-ink-soft')}>{value}</dd>
    </div>
  )
}
