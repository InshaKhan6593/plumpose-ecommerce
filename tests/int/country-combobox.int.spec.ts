import { describe, expect, it } from 'vitest'

import { filterCountries } from '@/components/forms/CountryCombobox'

/**
 * The country field she asked to be able to type into (28 Sep 2026): typing
 * shortens the list, with the likeliest match first.
 */

const countries = [
  { code: 'QA', name: 'Qatar' },
  { code: 'SA', name: 'Saudi Arabia' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'CI', name: "Côte d'Ivoire" },
  { code: 'BH', name: 'Bahrain' },
]
const names = (query: string) => filterCountries(countries, query).map((c) => c.name)

describe('country search', () => {
  it('shows everything before anything is typed', () => {
    expect(names('')).toHaveLength(countries.length)
  })

  it('puts names that start with the letters first', () => {
    expect(names('sa')[0]).toBe('Saudi Arabia')
    expect(names('u')).toEqual(['United Arab Emirates', 'United Kingdom', 'Saudi Arabia'])
  })

  it('finds a word inside a name', () => {
    expect(names('arab')).toEqual(['Saudi Arabia', 'United Arab Emirates'])
  })

  it('ignores case, spaces around the letters, and accents', () => {
    expect(names('  QATAR ')).toEqual(['Qatar'])
    expect(names('cote')).toEqual(["Côte d'Ivoire"])
  })

  it('matches the two-letter code', () => {
    expect(names('ae')[0]).toBe('United Arab Emirates')
  })

  it('returns nothing for letters in no name', () => {
    expect(names('zz')).toEqual([])
  })
})
