'use client'

import { toMinor } from '@/lib/pricing/money'
import { Money } from '@/providers/Locale'

import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import React, { useEffect, useMemo, useState } from 'react'

import { cleanLettering } from '@/lib/pricing/personalisation'
import { useLenis } from '@/motion/MotionProvider'
import { cn } from '@/utilities/cn'

import {
  type EmbroideryChoice,
  type EmbroideryOption,
  type EmbroideryRules,
  wantsLetters,
  wantsSymbol,
} from './embroidery'

/**
 * The hand-embroidery drawer (SCREEN-PROMPTS 07). One placement at a time:
 * where, what style, the letters, the symbol, the thread. Placements already
 * on this piece are shown but can't be picked twice — the engine refuses a
 * second embroidery on the same placement anyway.
 *
 * Lettering is cleaned as it is typed with the same function the server uses,
 * so what she sees is exactly what will be stitched.
 */
export function EmbroideryDrawer({
  initial,
  onOpenChange,
  onSave,
  open,
  options,
  rules,
  usedPlacements,
}: {
  initial?: EmbroideryChoice | null
  onOpenChange: (open: boolean) => void
  onSave: (choice: EmbroideryChoice) => void
  open: boolean
  options: EmbroideryOption[]
  rules: EmbroideryRules
  usedPlacements: string[]
}) {
  const lenis = useLenis()
  const byType = useMemo(
    () => ({
      placement: options.filter((o) => o.type === 'placement'),
      style: options.filter((o) => o.type === 'style'),
      symbol: options.filter((o) => o.type === 'symbol'),
      thread: options.filter((o) => o.type === 'thread'),
    }),
    [options],
  )

  const blank = (): EmbroideryChoice => ({
    lettering: '',
    placement: byType.placement.find((p) => !usedPlacements.includes(p.key ?? ''))?.key ?? '',
    style: 'text',
    symbol: byType.symbol[0]?.key ?? '',
    thread: byType.thread[0]?.key ?? '',
  })

  const [choice, setChoice] = useState<EmbroideryChoice>(initial ?? blank())

  // Start fresh (or from the placement being edited) every time it opens.
  useEffect(() => {
    if (open) setChoice(initial ?? blank())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // The page behind must not scroll while the drawer is open.
  useEffect(() => {
    if (open) lenis.current?.stop()
    else lenis.current?.start()
  }, [open, lenis])

  const set = <K extends keyof EmbroideryChoice>(key: K, value: EmbroideryChoice[K]) =>
    setChoice((c) => ({ ...c, [key]: value }))

  const lettersMissing = wantsLetters(choice.style) && !choice.lettering
  const canSave = Boolean(choice.placement) && !lettersMissing

  return (
    <Dialog.Root onOpenChange={onOpenChange} open={open}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/30 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[34rem] flex-col bg-background shadow-none duration-500 ease-brand data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:animate-in data-[state=open]:slide-in-from-right"
        >
          <header className="flex items-center justify-between border-b border-line px-7 py-6 md:px-10">
            <Dialog.Title className="serif-display text-3xl">Hand embroidery</Dialog.Title>
            <Dialog.Close aria-label="Close" className="-mr-1 p-1">
              <X className="size-5" strokeWidth={1.25} />
            </Dialog.Close>
          </header>

          <div className="flex-1 overflow-y-auto px-7 py-8 md:px-10" data-lenis-prevent>
            {/* 01 Placement */}
            <Step label="Placement" number="01">
              <div className="flex flex-wrap gap-2">
                {byType.placement.map((p) => {
                  const taken = usedPlacements.includes(p.key ?? '') && p.key !== initial?.placement
                  return (
                    <Choice
                      disabled={taken}
                      key={p.key}
                      onClick={() => set('placement', p.key ?? '')}
                      selected={choice.placement === p.key}
                      title={taken ? `${p.name} is already embroidered on this piece` : undefined}
                    >
                      {p.name}
                    </Choice>
                  )
                })}
              </div>
            </Step>

            {/* 02 Style */}
            <Step label="Style" number="02">
              <div className="flex flex-col gap-2">
                {byType.style.map((s) => (
                  <button
                    aria-pressed={choice.style === s.key}
                    className={cn(
                      'border px-5 py-4 text-left transition-colors duration-300 ease-brand',
                      choice.style === s.key ? 'border-ink' : 'border-line hover:border-ink/50',
                    )}
                    key={s.key}
                    onClick={() => set('style', s.key as EmbroideryChoice['style'])}
                    type="button"
                  >
                    <span className="block text-sm text-ink">{s.name}</span>
                    {s.note ? <span className="mt-1 block text-xs text-ink-soft">{s.note}</span> : null}
                  </button>
                ))}
              </div>
            </Step>

            {/* 03 Lettering */}
            {wantsLetters(choice.style) ? (
              <Step label="Lettering" number="03">
                <div className="flex items-end gap-4 border-b border-line focus-within:border-ink">
                  <input
                    aria-label="Lettering"
                    autoComplete="off"
                    className="serif-display w-full border-0 bg-transparent px-0 pb-2 text-3xl tracking-[0.12em] uppercase placeholder:text-ink-faint focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none"
                    maxLength={rules.maxChars}
                    onChange={(e) => set('lettering', cleanLettering(e.target.value, rules.maxChars).toUpperCase())}
                    placeholder="M.K"
                    value={choice.lettering}
                  />
                  <span className="shrink-0 pb-3 text-xs whitespace-nowrap text-ink-soft tabular-nums">
                    {choice.lettering.length} / {rules.maxChars}
                  </span>
                </div>
                <p className="mt-2 text-xs text-ink-soft">Letters, numbers, spaces, full stops, hyphens and &amp;.</p>
              </Step>
            ) : null}

            {/* 04 Symbol */}
            {wantsSymbol(choice.style) ? (
              <Step label="Symbol" number={wantsLetters(choice.style) ? '04' : '03'}>
                <div className="flex flex-wrap gap-2">
                  {byType.symbol.map((s) => (
                    <button
                      aria-label={s.name}
                      aria-pressed={choice.symbol === s.key}
                      className={cn(
                        'flex size-14 items-center justify-center border transition-colors duration-300 ease-brand',
                        choice.symbol === s.key ? 'border-ink bg-ink text-white' : 'border-line hover:border-ink/50',
                      )}
                      key={s.key}
                      onClick={() => set('symbol', s.key ?? '')}
                      title={s.name}
                      type="button"
                    >
                      <svg aria-hidden className="size-6" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2} viewBox="0 0 24 24">
                        <path d={s.svgPath ?? ''} />
                      </svg>
                    </button>
                  ))}
                </div>
              </Step>
            ) : null}

            {/* 05 Thread */}
            <Step label="Thread" number={String(2 + (wantsLetters(choice.style) ? 1 : 0) + (wantsSymbol(choice.style) ? 1 : 0) + 1).padStart(2, '0')}>
              <div className="flex flex-wrap items-center gap-3">
                {byType.thread.map((t) => (
                  /*
                   * The selection ring is the button's own border around an inset
                   * swatch — not a CSS ring, which the global focus styles can
                   * override, and which vanished against the pale cream thread.
                   */
                  <button
                    aria-label={t.name}
                    aria-pressed={choice.thread === t.key}
                    className={cn(
                      'flex size-10 items-center justify-center rounded-full border transition-colors duration-300 ease-brand',
                      choice.thread === t.key ? 'border-ink' : 'border-transparent hover:border-line',
                    )}
                    key={t.key}
                    onClick={() => set('thread', t.key ?? '')}
                    title={t.name}
                    type="button"
                  >
                    <span
                      aria-hidden
                      className="size-7 rounded-full border border-line"
                      style={{ backgroundColor: t.hex ?? undefined }}
                    />
                  </button>
                ))}
                <span className="ml-1 text-xs text-ink-soft">
                  {byType.thread.find((t) => t.key === choice.thread)?.name}
                </span>
              </div>
            </Step>
          </div>

          <footer className="border-t border-line px-7 py-6 md:px-10">
            <div className="flex items-baseline justify-between">
              <span className="caps text-[0.625rem]">Embroidery</span>
              <Money className="text-sm tabular-nums" minor={toMinor(rules.feeQar)} />
            </div>
            <p className="mt-2 text-xs leading-relaxed text-ink-soft">
              {rules.leadTime ? `Made to order in ${rules.leadTime}. ` : ''}
              {rules.returnable ? '' : 'Personalised pieces cannot be returned.'}
            </p>
            <button
              className="caps mt-5 h-12 w-full bg-ink text-[0.6875rem] text-white transition-colors hover:bg-ink/85 disabled:cursor-not-allowed disabled:bg-ink/60"
              disabled={!canSave}
              onClick={() => {
                onSave({
                  ...choice,
                  lettering: wantsLetters(choice.style) ? choice.lettering : '',
                  symbol: wantsSymbol(choice.style) ? choice.symbol : '',
                })
                onOpenChange(false)
              }}
              type="button"
            >
              {lettersMissing ? 'Add your letters' : initial ? 'Save embroidery' : 'Add embroidery'}
            </button>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function Step({ children, label, number }: { children: React.ReactNode; label: string; number: string }) {
  return (
    <section className="mb-9">
      <h3 className="caps mb-4 text-[0.625rem] text-ink">
        <span className="mr-2 text-ink-soft">{number}</span>
        {label}
      </h3>
      {children}
    </section>
  )
}

function Choice({
  children,
  disabled,
  onClick,
  selected,
  title,
}: {
  children: React.ReactNode
  disabled?: boolean
  onClick: () => void
  selected: boolean
  title?: string
}) {
  return (
    <button
      aria-pressed={selected}
      className={cn(
        'caps border px-5 py-3 text-[0.625rem] transition-colors duration-300 ease-brand',
        selected ? 'border-ink bg-ink text-white' : 'border-line hover:border-ink/50',
        disabled && 'cursor-not-allowed text-ink-faint line-through hover:border-line',
      )}
      disabled={disabled}
      onClick={onClick}
      title={title}
      type="button"
    >
      {children}
    </button>
  )
}
