import { describe, expect, it } from 'vitest'

import { convertMinor, type DisplayCurrency, displayMinor, formatMoney, impliedRate, isQuotable } from '@/lib/pricing/currency'

// From the seeded table (her old site's list): Al Shaheen Nights, QAR 1,399.
const ANCHOR = 1399
const AED: DisplayCurrency = { code: 'AED', decimals: 0, name: 'UAE Dirham', price: 1410, rate: null, step: 10, symbol: 'AED' }
const GBP: DisplayCurrency = { code: 'GBP', decimals: 0, name: 'Pound Sterling', price: 295, rate: null, step: 5, symbol: '£' }
const KWD: DisplayCurrency = { code: 'KWD', decimals: 1, name: 'Kuwaiti Dinar', price: 118, rate: null, step: 1, symbol: 'KWD' }
const RATE_ONLY: DisplayCurrency = { code: 'XYZ', decimals: 2, name: 'Test', price: null, rate: 0.5, step: 1, symbol: 'X' }
const NONE: DisplayCurrency = { code: 'NOP', decimals: 0, name: 'Nothing', price: null, rate: null, step: 1, symbol: 'N' }

describe('currency — her hand-set price is sacred', () => {
  it('shows exactly the figure she set for one piece, and exactly twice it for two', () => {
    expect(convertMinor(139900, AED, ANCHOR)).toBe(1410)
    expect(convertMinor(279800, AED, ANCHOR)).toBe(2820)
    expect(displayMinor(139900, GBP, ANCHOR)).toBe('£295')
  })

  it('converts everything else at the rate her price implies, rounded to the market’s step', () => {
    // QAR 160 embroidery → 160 × 1410/1399 = 161.26 → nearest AED 10 = AED 160
    expect(convertMinor(16000, AED, ANCHOR)).toBe(160)
    // QAR 20 Doha delivery → 20 × 295/1399 = 4.22 → nearest £5 = £5
    expect(convertMinor(2000, GBP, ANCHOR)).toBe(5)
    // a piece plus embroidery is not a multiple: QAR 1,559 → 1,571.3 → AED 1,570
    expect(convertMinor(155900, AED, ANCHOR)).toBe(1570)
  })

  it('uses a stored rate only where there is no hand-set price', () => {
    expect(impliedRate(AED, ANCHOR)).toBeCloseTo(1410 / 1399)
    expect(impliedRate(RATE_ONLY, ANCHOR)).toBe(0.5)
    expect(convertMinor(10000, RATE_ONLY, ANCHOR)).toBe(50)
  })
})

describe('currency — reading as the market reads', () => {
  it('puts a space after a letter code and none after a sign; keeps the currency’s decimals', () => {
    expect(formatMoney(1410, AED)).toBe('AED 1,410')
    expect(formatMoney(295, GBP)).toBe('£295')
    expect(formatMoney(118, KWD)).toBe('KWD 118.0')
  })

  it('falls back to QAR for QAR itself, for no choice, and for a currency that cannot be priced', () => {
    const QAR: DisplayCurrency = { code: 'QAR', decimals: 0, name: 'Qatari Riyal', price: 1399, rate: 1, step: 5, symbol: 'QAR' }
    expect(displayMinor(139900, QAR, ANCHOR)).toBe('QAR 1,399.00')
    expect(displayMinor(139900, null, ANCHOR)).toBe('QAR 1,399.00')
    expect(isQuotable(NONE, ANCHOR)).toBe(false)
    expect(displayMinor(139900, NONE, ANCHOR)).toBe('QAR 1,399.00')
  })
})
