import { describe, expect, it } from 'vitest'

import { webSlug } from '@/utilities/webSlug'

/**
 * Web addresses made from titles (found recording the "add a piece" video,
 * 28 Sep 2026): Payload's own slugify gave `al-shaheen-nights--silk-pyjama-set`.
 */
describe('webSlug', () => {
  it('joins words across a dash with one hyphen', () => {
    expect(webSlug('Al Shaheen Nights — Silk Pyjama Set')).toBe('al-shaheen-nights-silk-pyjama-set')
  })

  it('keeps accented letters, without the accent', () => {
    expect(webSlug('Crème Brûlée Robe')).toBe('creme-brulee-robe')
  })

  it('reads & as "and" and trims the ends', () => {
    expect(webSlug('  Sleep & Lounge!  ')).toBe('sleep-and-lounge')
  })

  it('leaves an existing address as it is', () => {
    expect(webSlug('resort-2026')).toBe('resort-2026')
  })
})
