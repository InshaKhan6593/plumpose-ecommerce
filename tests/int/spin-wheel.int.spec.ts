import { describe, expect, it } from 'vitest'

import { buildSpinRewardEmail } from '@/email/spinRewardEmail'
import { describeReward, drawableSegments, newRewardCode, pickSegment, rewardExpiry } from '@/lib/spin/wheel'

type Seg = { active?: boolean; id: number; label: string; rewardType: 'fixed' | 'freeShipping' | 'percent' | 'rollAgain'; rewardValue?: number; weight: number }

// The seeded wheel: 10% off (40) · QAR 100 off (15) · Free delivery (25) · Roll again (20).
const WHEEL: Seg[] = [
  { active: true, id: 1, label: '10% off', rewardType: 'percent', rewardValue: 10, weight: 40 },
  { active: true, id: 2, label: 'QAR 100 off', rewardType: 'fixed', rewardValue: 100, weight: 15 },
  { active: true, id: 3, label: 'Free delivery', rewardType: 'freeShipping', weight: 25 },
  { active: true, id: 4, label: 'Roll again', rewardType: 'rollAgain', weight: 20 },
]

describe('reward wheel — what can be won', () => {
  it('offers every active prize, and roll again only while spins are left', () => {
    expect(drawableSegments(WHEEL, { rerollsLeft: 1 }).map((s) => s.id)).toEqual([1, 2, 3, 4])
    expect(drawableSegments(WHEEL, { rerollsLeft: 0 }).map((s) => s.id)).toEqual([1, 2, 3])
  })

  it('never issues a prize worth nothing, or a segment she has switched off', () => {
    const broken: Seg[] = [
      { active: true, id: 5, label: 'Oops', rewardType: 'percent', weight: 50 },
      { active: true, id: 6, label: 'Too much', rewardType: 'percent', rewardValue: 150, weight: 50 },
      { active: false, id: 7, label: 'Off', rewardType: 'freeShipping', weight: 50 },
      { active: true, id: 8, label: 'Weightless', rewardType: 'freeShipping', weight: 0 },
    ]
    expect(drawableSegments(broken, { rerollsLeft: 1 })).toEqual([])
  })
})

describe('reward wheel — the draw', () => {
  it('lands where the weights say', () => {
    const at = (r: number) => pickSegment(WHEEL, () => r)?.id
    expect(at(0)).toBe(1)
    expect(at(0.3999)).toBe(1) // first 40%
    expect(at(0.4)).toBe(2) // next 15%
    expect(at(0.5499)).toBe(2)
    expect(at(0.55)).toBe(3) // next 25%
    expect(at(0.8)).toBe(4) // last 20%
    expect(at(0.9999999)).toBe(4)
  })

  it('matches the odds over many real spins (within a few percent)', () => {
    const counts = new Map<number, number>()
    const n = 20000
    for (let i = 0; i < n; i++) {
      const id = pickSegment(WHEEL)!.id
      counts.set(id, (counts.get(id) ?? 0) + 1)
    }
    expect((counts.get(1) ?? 0) / n).toBeGreaterThan(0.37)
    expect((counts.get(1) ?? 0) / n).toBeLessThan(0.43)
    expect((counts.get(2) ?? 0) / n).toBeGreaterThan(0.12)
    expect((counts.get(2) ?? 0) / n).toBeLessThan(0.18)
  })

  it('returns nothing when nothing can be won', () => {
    expect(pickSegment([])).toBeNull()
    expect(pickSegment([{ weight: 0 }])).toBeNull()
  })
})

describe('reward wheel — the code', () => {
  it('reads PLUM-XXXX-XX with no look-alike characters', () => {
    for (let i = 0; i < 200; i++) expect(newRewardCode()).toMatch(/^PLUM-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{2}$/)
  })

  it('differs every time', () => {
    const codes = new Set(Array.from({ length: 2000 }, () => newRewardCode()))
    expect(codes.size).toBe(2000)
  })

  it('expires at the end of the day in Doha, the given number of days on', () => {
    // 25 Sep 2026, 10:00 in Doha → 30 days → 25 Oct 2026, 23:59:59 Doha = 20:59:59 UTC.
    expect(rewardExpiry(30, new Date('2026-09-25T07:00:00Z')).toISOString()).toBe('2026-10-25T20:59:59.000Z')
  })

  it('describes the prize in words', () => {
    expect(WHEEL.map(describeReward)).toEqual(['10% off', 'QAR 100 off', 'Free delivery', 'Another spin'])
  })
})

describe('reward wheel — the code email', () => {
  it('carries the code, the prize, the expiry in Doha and the one-use rule', () => {
    const email = buildSpinRewardEmail({
      code: { code: 'PLUM-7K4Q-X2', expiresAt: '2026-10-25T20:59:59.000Z', type: 'percent', value: 10 },
      shopUrl: 'http://localhost:3000/shop',
    })
    expect(email.subject).toBe('Your plumpose code: 10% off')
    expect(email.html).toContain('PLUM-7K4Q-X2')
    expect(email.html).toContain('Valid until 25 October 2026')
    expect(email.text).toContain('One use, for this email address only.')
  })

  it('names free delivery and fixed amounts in words', () => {
    const at = (type: 'fixed' | 'freeShipping', value?: number) =>
      buildSpinRewardEmail({ code: { code: 'X', expiresAt: null, type, value }, shopUrl: 'x' }).subject
    expect(at('fixed', 100)).toBe('Your plumpose code: QAR 100 off')
    expect(at('freeShipping')).toBe('Your plumpose code: Free delivery')
  })
})
