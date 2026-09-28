'use client'

import { ChevronDown } from 'lucide-react'
import React, { useId, useMemo, useRef, useState } from 'react'

import { cn } from '@/utilities/cn'

export type ComboCountry = {
  code: string
  name: string
  /** Shown after the name, e.g. " — unavailable". */
  note?: string
  /** Shown before the name, e.g. a flag. */
  prefix?: string
}

/** Lower case, accents off: "Côte d'Ivoire" is found by typing "cote". */
const fold = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()

/**
 * Names that start with what was typed come first, then names with a word
 * that starts with it ("ara" → "Saudi Arabia", "United Arab Emirates"), then
 * any other match. A two-letter code matches too ("sa", "ae").
 */
export const filterCountries = <T extends ComboCountry>(countries: T[], query: string): T[] => {
  const q = fold(query)
  if (!q) return countries
  const starts: T[] = []
  const wordStarts: T[] = []
  const contains: T[] = []
  for (const c of countries) {
    const name = fold(c.name)
    if (name.startsWith(q) || fold(c.code) === q) starts.push(c)
    else if (name.split(/[\s\-(]+/).some((word) => word.startsWith(q))) wordStarts.push(c)
    else if (name.includes(q)) contains.push(c)
  }
  return [...starts, ...wordStarts, ...contains]
}

/**
 * A country field you can type into to shorten the list — her request of
 * 28 Sep 2026 ("can we have option to type letter to shorten the list"), in
 * place of a native select, which on a phone can only be scrolled.
 *
 * An ARIA combobox: focus opens the list, typing filters it, arrows move,
 * Enter picks, Escape puts the last choice back. Leaving the field without
 * picking keeps the country it had. An exact name (typed, or put there by the
 * browser's autofill) is picked on its own.
 *
 * Also the Qatar city field (checkout, address book) — a native select there
 * looked like the browser's own and could not be searched.
 */
export function CountryCombobox({
  'aria-describedby': describedBy,
  'aria-invalid': invalid,
  autoComplete = 'country-name',
  className,
  countries,
  id,
  name,
  noMatch = 'No country matches',
  onChange,
  placeholder = 'Type to search',
  value,
}: {
  'aria-describedby'?: string
  'aria-invalid'?: boolean
  autoComplete?: string
  /** Classes for the text field — the page's own input style. */
  className?: string
  countries: ComboCountry[]
  id: string
  /** So a form can find the field by name (checkout moves to the first one missing). */
  name?: string
  /** Shown when nothing matches, before the typed text. */
  noMatch?: string
  onChange: (code: string) => void
  placeholder?: string
  value: string
}) {
  const listId = useId()
  const list = useRef<HTMLUListElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)

  const selected = countries.find((c) => c.code === value)
  const shown = useMemo(() => filterCountries(countries, query), [countries, query])

  const pick = (code: string) => {
    onChange(code)
    setOpen(false)
    setQuery('')
  }

  const moveTo = (index: number) => {
    const next = Math.max(0, Math.min(shown.length - 1, index))
    setActive(next)
    list.current
      ?.querySelector<HTMLElement>(`[data-index="${next}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }

  const openList = () => {
    setOpen(true)
    setQuery('')
    const at = countries.findIndex((c) => c.code === value)
    setActive(Math.max(0, at))
    requestAnimationFrame(() =>
      list.current
        ?.querySelector<HTMLElement>(`[data-index="${Math.max(0, at)}"]`)
        ?.scrollIntoView({ block: 'nearest' }),
    )
  }

  return (
    <div className="relative">
      <input
        aria-activedescendant={open && shown[active] ? `${listId}-${shown[active].code}` : undefined}
        aria-autocomplete="list"
        aria-controls={listId}
        aria-describedby={describedBy}
        aria-expanded={open}
        aria-invalid={invalid}
        autoComplete={autoComplete}
        className={cn(className, 'pr-8')}
        id={id}
        name={name}
        onBlur={() => {
          setOpen(false)
          setQuery('')
        }}
        onChange={(e) => {
          const text = e.target.value
          const exact = countries.find((c) => fold(c.name) === fold(text))
          if (exact && document.activeElement !== e.target) return pick(exact.code)
          setQuery(text)
          setOpen(true)
          setActive(0)
        }}
        onClick={() => {
          if (!open) openList()
        }}
        onFocus={(e) => {
          openList()
          e.target.select()
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            if (!open) openList()
            else moveTo(active + 1)
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            moveTo(active - 1)
          } else if (e.key === 'Enter') {
            if (open && shown[active]) {
              e.preventDefault()
              pick(shown[active].code)
            }
          } else if (e.key === 'Escape') {
            if (open) {
              e.preventDefault()
              setOpen(false)
              setQuery('')
            }
          }
        }}
        placeholder={placeholder}
        role="combobox"
        spellCheck={false}
        type="text"
        value={
          open
            ? query
            : selected
              ? `${selected.prefix ? `${selected.prefix} ` : ''}${selected.name}`
              : ''
        }
      />
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-0 size-4 -translate-y-1/2 text-ink-soft"
        strokeWidth={1.25}
      />

      {open ? (
        <ul
          className="absolute inset-x-0 top-full z-50 mt-1 max-h-64 overflow-y-auto overscroll-contain border border-line bg-paper-2 py-1 shadow-[0_12px_32px_rgba(27,24,21,0.12)]"
          data-lenis-prevent
          id={listId}
          ref={list}
          role="listbox"
        >
          {shown.length ? (
            shown.map((c, index) => (
              <li
                aria-selected={c.code === value}
                className={cn(
                  'flex cursor-pointer items-baseline gap-2 px-4 py-2.5 text-[0.9375rem]',
                  index === active ? 'bg-paper-3' : '',
                  c.code === value && 'text-ink',
                )}
                data-index={index}
                id={`${listId}-${c.code}`}
                key={c.code}
                // Pick on mousedown, before the field's blur closes the list.
                onMouseDown={(e) => {
                  e.preventDefault()
                  pick(c.code)
                }}
                onMouseMove={() => setActive(index)}
                role="option"
              >
                {c.prefix ? <span aria-hidden>{c.prefix}</span> : null}
                <span>{c.name}</span>
                {c.note ? <span className="text-ink-faint">{c.note}</span> : null}
              </li>
            ))
          ) : (
            <li className="px-4 py-2.5 text-[0.9375rem] text-ink-faint" role="presentation">
              {noMatch} “{query}”
            </li>
          )}
        </ul>
      ) : null}
    </div>
  )
}
