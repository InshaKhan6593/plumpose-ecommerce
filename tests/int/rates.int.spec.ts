import { describe, expect, it } from 'vitest'

import { fetchRates, formatDifference, rateCheck } from '@/lib/pricing/rates'

/** Exchange-rate refresh (REQUIREMENTS A14). The live service is stood in for, so the tests never depend on the network. */

const reply = (body: unknown, status = 200) => (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch

describe('rates — fetching', () => {
  it('reads QAR rates and the time they are from', async () => {
    const rates = await fetchRates(reply({ base_code: 'QAR', rates: { AED: 1.008929, GBP: 0.207814, QAR: 1, bad: -1, XXXX: 2 }, result: 'success', time_last_update_unix: 1790208151 }))
    expect(rates.rates).toEqual({ AED: 1.008929, GBP: 0.207814, QAR: 1 })
    expect(rates.updatedAt).toBe(new Date(1790208151 * 1000).toISOString())
  })

  it('refuses rates on another base, or an error, rather than writing wrong numbers', async () => {
    await expect(fetchRates(reply({ base_code: 'USD', rates: { AED: 3.67 }, result: 'success' }))).rejects.toThrow(/QAR/)
    await expect(fetchRates(reply({ result: 'error' }))).rejects.toThrow()
    await expect(fetchRates(reply({}, 503))).rejects.toThrow(/503/)
  })
})

describe('rates — checking her hand-set price', () => {
  it('shows what today’s rate would make the anchor piece, and how far her price is from it', () => {
    const check = rateCheck({ anchorQar: 1399, price: 1410, rate: 1.008929 })!
    expect(check.atRate).toBeCloseTo(1411.49, 1)
    expect(formatDifference(check.difference)).toBe('−0.1%')
    expect(formatDifference(rateCheck({ anchorQar: 1399, price: 330, rate: 0.241396 })!.difference)).toBe('−2.3%')
    expect(formatDifference(rateCheck({ anchorQar: 1399, price: 300, rate: 0.207814 })!.difference)).toBe('+3.2%')
  })

  it('has nothing to say without a rate', () => {
    expect(rateCheck({ anchorQar: 1399, price: 1410, rate: null })).toBeNull()
    expect(formatDifference(0.0001)).toBe('0.0%')
  })
})
