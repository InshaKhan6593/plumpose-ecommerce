'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React, { useCallback, useEffect, useRef, useState } from 'react'

import { Wordmark } from '@/components/brand/Wordmark'
import { HouseAlert, houseInput } from '@/components/forms/house'
import { prefersReducedMotion } from '@/motion/gsap'
import { useLenis } from '@/motion/MotionProvider'

/**
 * The first-visit reward wheel (REQUIREMENTS C7; docs/SCREEN-PROMPTS 15; the
 * approved preview). All of the deciding happens in `POST /api/spin` — this
 * only shows the wheel, sends the email, and turns the wheel to the segment
 * the server chose.
 *
 * When it appears: once per browser, a few seconds into a visit, never on
 * checkout, order, account or sign-in pages, and never again after it has been
 * won or closed. Nothing loads until then — not even the wheel's data.
 */

type WheelData = {
  body: string
  centreImage: null | string
  enabled: boolean
  heading: string
  segments: Array<{ colour: string; id: number; label: string }>
  validDays: number
}

type Won = { code: string; expiresAt: string; reward: string; segmentId: number }
type Phase = 'again' | 'ask' | 'spinning' | 'won'

/** Remembered on this browser: the wheel is done with. The code itself, for checkout to offer. */
const SEEN_KEY = 'plumpose:wheel'
export const WHEEL_CODE_KEY = 'plumpose:wheel-code'
const DELAY_MS = 6000
const SPIN_MS = 5200
/** Where a pop-up would get in the way of something already under way. */
const QUIET = [
  '/checkout',
  '/order',
  '/account',
  '/orders',
  '/login',
  '/create-account',
  '/forgot-password',
  '/reset-password',
  '/logout',
  '/find-order',
]

const store = {
  get: (key: string) => {
    try {
      return window.localStorage.getItem(key)
    } catch {
      return null
    }
  },
  set: (key: string, value: string) => {
    try {
      window.localStorage.setItem(key, value)
    } catch {
      /* private window or blocked storage: the wheel may simply show again next visit */
    }
  },
}

const dateFormat = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  timeZone: 'Asia/Qatar',
  year: 'numeric',
})

/** "10% off" → "10% off your first order"; "Free delivery" → "Free delivery on your first order". */
const prizeHeading = (reward: string) =>
  /^free/i.test(reward) ? `${reward} on your first order` : `${reward} your first order`

export function RewardWheel() {
  const pathname = usePathname()
  const lenis = useLenis()
  const [data, setData] = useState<null | WheelData>(null)
  const [open, setOpen] = useState(false)
  const [phase, setPhase] = useState<Phase>('ask')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState<null | string>(null)
  const [rotation, setRotation] = useState(0)
  const [won, setWon] = useState<null | Won>(null)
  const [landed, setLanded] = useState<null | number>(null)
  const [copied, setCopied] = useState(false)
  const reduced = useRef(false)

  // ---- when to appear ----
  useEffect(() => {
    if (QUIET.some((p) => pathname.startsWith(p)) || store.get(SEEN_KEY)) return
    reduced.current = prefersReducedMotion()
    const timer = window.setTimeout(async () => {
      const res = await fetch('/api/spin').catch(() => null)
      const wheel = (await res?.json().catch(() => null)) as null | WheelData
      if (wheel?.enabled && wheel.segments.length >= 2) {
        setData(wheel)
        setOpen(true)
      }
    }, DELAY_MS)
    return () => window.clearTimeout(timer)
    // Once per page load: a later navigation does not restart the clock.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (open) lenis.current?.stop()
    else lenis.current?.start()
  }, [open, lenis])

  const close = (next: boolean) => {
    if (next) return
    if (phase === 'spinning') return // let the wheel finish; the result is already decided
    setOpen(false)
    store.set(SEEN_KEY, phase === 'won' ? 'won' : 'closed')
  }

  // ---- the spin ----
  const turnTo = useCallback(
    (segmentId: number) => {
      if (!data) return
      const index = Math.max(
        0,
        data.segments.findIndex((s) => s.id === segmentId),
      )
      const slice = 360 / data.segments.length
      // Land inside the segment, not on its centre line every time — but well clear of the edges.
      const jitter = (Math.random() - 0.5) * slice * 0.6
      const target = (((-(index + 0.5) * slice + jitter) % 360) + 360) % 360
      setRotation((current) => {
        const from = ((current % 360) + 360) % 360
        const forward = (target - from + 360) % 360
        return current + (reduced.current ? 0 : 360 * 5) + forward
      })
    },
    [data],
  )

  const spin = async (event?: React.FormEvent) => {
    event?.preventDefault()
    const address = email.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(address)) {
      setMessage('Please enter your email address.')
      return
    }
    setMessage(null)
    setLanded(null)
    setPhase('spinning')

    const res = await fetch('/api/spin', {
      body: JSON.stringify({ email: address }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    }).catch(() => null)
    const result = (await res?.json().catch(() => null)) as
      | ({ outcome: 'won' } & Won)
      | { message?: string; outcome: 'alreadySpun' | 'closed' | 'error' | 'invalid' | 'tooMany' }
      | { outcome: 'rollAgain'; segmentId: number; spinsLeft: number }
      | null

    if (!result || !('segmentId' in result)) {
      setPhase('ask')
      setMessage(
        (result && 'message' in result && result.message) || 'That didn’t work. Please try again.',
      )
      return
    }

    turnTo(result.segmentId)
    window.setTimeout(
      () => {
        setLanded(result.segmentId)
        if (result.outcome === 'won') {
          setWon(result)
          setPhase('won')
          store.set(SEEN_KEY, 'won')
          store.set(WHEEL_CODE_KEY, result.code)
        } else {
          setPhase('again')
        }
      },
      reduced.current ? 0 : SPIN_MS + 150,
    )
  }

  const copy = async () => {
    if (!won) return
    await navigator.clipboard?.writeText(won.code).catch(() => undefined)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  if (!data) return null

  return (
    <Dialog.Root onOpenChange={close} open={open}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/50 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content
          aria-describedby="wheel-words"
          // Focus the pop-up itself: not the × (which then shows a focus box), and not the
          // email field (which would throw a phone's keyboard up before she has read a word).
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            ;(event.currentTarget as HTMLElement | null)?.focus()
          }}
          tabIndex={-1}
          className="fixed top-1/2 left-1/2 z-50 max-h-[94svh] w-[calc(100vw-1.5rem)] outline-none max-w-5xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto border border-line bg-paper-3 text-ink duration-500 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.98]"
          data-lenis-prevent
        >
          <Dialog.Close
            aria-label="Close"
            className="absolute top-4 right-4 p-2 text-ink-soft transition-colors hover:text-ink md:top-5 md:right-5"
          >
            <X className="size-5" strokeWidth={1.25} />
          </Dialog.Close>

          <div className="flex justify-center pt-5 md:pt-9">
            <Wordmark className="h-5 w-auto md:h-7" />
          </div>

          <div className="grid items-center gap-6 px-5 pt-5 pb-7 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-14 md:px-14 md:pt-8 md:pb-14">
            <Wheel
              data={data}
              dim={phase === 'won'}
              landed={landed}
              rotation={rotation}
              spinning={phase === 'spinning'}
              spinMs={reduced.current ? 0 : SPIN_MS}
            />

            <div aria-live="polite">
              {phase === 'won' && won ? (
                <Prize copied={copied} onCopy={copy} onShop={() => close(false)} won={won} />
              ) : (
                <form noValidate onSubmit={spin}>
                  <p className="caps text-[0.625rem] text-ink-soft">
                    {phase === 'again' ? 'One more turn' : 'For your first visit'}
                  </p>
                  <Dialog.Title className="serif-display mt-3 text-[clamp(2rem,4vw,3.5rem)] leading-[1.05] md:mt-4">
                    {phase === 'again' ? 'Roll again' : data.heading}
                  </Dialog.Title>
                  <p
                    className="mt-5 max-w-md text-[0.9375rem] leading-[1.75] text-ink-soft"
                    id="wheel-words"
                  >
                    {phase === 'again' ? 'The wheel has given you another spin.' : data.body}
                  </p>

                  {phase !== 'again' ? (
                    <div className="mt-8">
                      <label className="sr-only" htmlFor="wheel-email">
                        Your email
                      </label>
                      <input
                        autoComplete="email"
                        className={houseInput}
                        disabled={phase === 'spinning'}
                        id="wheel-email"
                        inputMode="email"
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Your email"
                        type="email"
                        value={email}
                      />
                    </div>
                  ) : null}

                  {message ? (
                    <div className="mt-4">
                      <HouseAlert>{message}</HouseAlert>
                    </div>
                  ) : null}

                  <button
                    className="caps mt-7 flex h-12 w-full items-center justify-center bg-ink text-[0.6875rem] text-white transition-colors hover:bg-ink/85 disabled:bg-ink/60"
                    disabled={phase === 'spinning'}
                    type="submit"
                  >
                    {phase === 'spinning'
                      ? 'Spinning…'
                      : phase === 'again'
                        ? 'Spin again'
                        : 'Spin the wheel'}
                  </button>
                  <p className="mt-4 text-[0.75rem] leading-relaxed text-ink-soft">
                    One spin per email. Your code arrives by email and lasts {data.validDays} days.
                  </p>
                </form>
              )}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function Prize({
  copied,
  onCopy,
  onShop,
  won,
}: {
  copied: boolean
  onCopy: () => void
  onShop: () => void
  won: Won
}) {
  return (
    <div>
      <p className="caps text-[0.625rem] text-ink-soft">Yours</p>
      <Dialog.Title className="serif-display mt-3 text-[clamp(2rem,4vw,3.5rem)] leading-[1.05] md:mt-4">
        {prizeHeading(won.reward)}
      </Dialog.Title>
      <p className="mt-5 text-[0.9375rem] leading-[1.75] text-ink-soft" id="wheel-words">
        Enter this code at checkout. We have emailed it to you as well.
      </p>
      <div className="mt-7 flex items-center justify-between gap-4 border border-line px-5 py-4">
        <span className="text-[1.125rem] tracking-[0.24em] tabular-nums">{won.code}</span>
        <button
          className="caps shrink-0 border-b border-ink pb-0.5 text-[0.5625rem] transition-opacity hover:opacity-60"
          onClick={onCopy}
          type="button"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <p className="caps mt-4 text-[0.5625rem] text-ink-soft">
        Valid until {dateFormat.format(new Date(won.expiresAt))} · One use
      </p>
      <Link
        className="caps mt-8 flex h-12 w-full items-center justify-center bg-ink text-[0.6875rem] text-white transition-colors hover:bg-ink/85"
        href="/shop"
        onClick={onShop}
      >
        Shop the collection
      </Link>
    </div>
  )
}

/**
 * The wheel, drawn from the live segments — so a prize she adds, renames or
 * switches off in the admin appears here as it is. Segments start at the top
 * and run clockwise; the pointer stays still while the wheel turns under it.
 */
function Wheel({
  data,
  dim,
  landed,
  rotation,
  spinMs,
  spinning,
}: {
  data: WheelData
  dim: boolean
  landed: null | number
  rotation: number
  spinMs: number
  spinning: boolean
}) {
  const R = 190
  const n = data.segments.length
  const slice = (2 * Math.PI) / n
  // Angle 0 is the top, increasing clockwise.
  const at = (angle: number, r: number) => [r * Math.sin(angle), -r * Math.cos(angle)] as const

  return (
    <div className="relative mx-auto w-full max-w-[12.5rem] md:max-w-[26rem]">
      {/* The pointer, fixed at the top. */}
      <svg
        aria-hidden
        className="absolute -top-3 left-1/2 z-10 w-5 -translate-x-1/2 md:-top-4 md:w-6"
        viewBox="0 0 20 24"
      >
        <path d="M0 0 H20 L10 24 Z" fill="var(--color-ink)" />
      </svg>

      <svg aria-hidden className="block w-full" viewBox="-200 -200 400 400">
        <defs>
          <clipPath id="wheel-centre">
            <circle r="52" />
          </clipPath>
        </defs>

        <g
          style={{
            transform: `rotate(${rotation}deg)`,
            transformOrigin: '0px 0px',
            // Silk, not snap: a long, soft landing (MOTION-SPEC §1).
            transition: spinning
              ? `transform ${spinMs}ms cubic-bezier(0.12, 0.8, 0.18, 1)`
              : 'none',
          }}
        >
          {data.segments.map((segment, i) => {
            const [x1, y1] = at(i * slice, R)
            const [x2, y2] = at((i + 1) * slice, R)
            const [lx, ly] = at((i + 0.5) * slice, R * 0.6)
            const isWinner = dim && landed === segment.id
            const words = segment.label.toUpperCase().split(' ')
            // Two short words stack, as on the preview ("FREE / DELIVERY"); "QAR 100 OFF" stays one line.
            const lines =
              words.length === 2 && segment.label.length >= 10
                ? words
                : [segment.label.toUpperCase()]
            return (
              <g
                key={segment.id}
                opacity={dim && !isWinner ? 0.45 : 1}
                style={{ transition: 'opacity 600ms' }}
              >
                <path
                  d={`M0 0 L${x1} ${y1} A${R} ${R} 0 ${slice > Math.PI ? 1 : 0} 1 ${x2} ${y2} Z`}
                  fill={isWinner ? 'var(--color-ink)' : segment.colour}
                  stroke="var(--color-ink)"
                  strokeWidth="0.8"
                />
                {/*
                  The label turns back as the wheel turns, so it stays level at
                  every angle — as on the approved preview — and reads straight
                  wherever the wheel comes to rest.
                */}
                <g
                  style={{
                    transform: `rotate(${-rotation}deg)`,
                    transformOrigin: `${lx}px ${ly}px`,
                    transition: spinning
                      ? `transform ${spinMs}ms cubic-bezier(0.12, 0.8, 0.18, 1)`
                      : 'none',
                  }}
                >
                  <text
                    fill={isWinner ? '#fff' : 'var(--color-ink)'}
                    fontFamily="var(--font-jost), sans-serif"
                    fontSize="11.5"
                    letterSpacing="3.2"
                    textAnchor="middle"
                    x={lx}
                    y={ly - (lines.length - 1) * 8 + 4}
                  >
                    {lines.map((line, n2) => (
                      <tspan dy={n2 === 0 ? 0 : 17} key={line} x={lx}>
                        {line}
                      </tspan>
                    ))}
                  </text>
                </g>
              </g>
            )
          })}

          {/* The print, at the heart of it. */}
          <circle fill="#1c1b29" r="52" />
          {data.centreImage ? (
            <image
              clipPath="url(#wheel-centre)"
              height="104"
              href={data.centreImage}
              preserveAspectRatio="xMidYMid slice"
              width="104"
              x="-52"
              y="-52"
            />
          ) : null}
        </g>

        <circle fill="none" r={R} stroke="var(--color-ink)" strokeWidth="1.2" />
      </svg>

      <ul className="sr-only">
        {data.segments.map((s) => (
          <li key={s.id}>{s.label}</li>
        ))}
      </ul>
    </div>
  )
}
