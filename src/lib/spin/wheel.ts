import { randomInt } from 'node:crypto'

import type { SpinSegment } from '@/payload-types'

/**
 * The first-visit reward wheel (REQUIREMENTS C7, A8) — the pure part: which
 * segments can be won, the weighted draw, and the code a prize becomes.
 * Everything here runs on the server; the browser is only ever told the
 * result, never the odds (`spinSegments.weight` is admin-only at field level).
 */

export type Drawable = Pick<SpinSegment, 'id' | 'label' | 'rewardType' | 'rewardValue' | 'weight'>

/**
 * The segments this spin can land on:
 *   - active, with a weight above zero;
 *   - a money prize must actually be worth something — a "10% off" segment
 *     saved with no value would otherwise issue a code for nothing;
 *   - "roll again" only while the visitor has extra spins left, so the wheel
 *     can never keep someone spinning for ever.
 */
export const drawableSegments = <T extends Drawable & Pick<SpinSegment, 'active'>>(
  segments: T[],
  args: { rerollsLeft: number },
): T[] =>
  segments.filter((s) => {
    if (s.active === false || !(s.weight > 0)) return false
    if (s.rewardType === 'rollAgain') return args.rerollsLeft > 0
    if (s.rewardType === 'percent') return (s.rewardValue ?? 0) > 0 && (s.rewardValue ?? 0) <= 100
    if (s.rewardType === 'fixed') return (s.rewardValue ?? 0) > 0
    return s.rewardType === 'freeShipping'
  })

/**
 * A weighted draw. `random` returns a number in [0, 1) — cryptographic by
 * default, injectable for tests. Weights are relative: 40 / 15 / 25 / 20 means
 * a 40% chance of the first.
 */
export const pickSegment = <T extends Pick<Drawable, 'weight'>>(
  segments: T[],
  random: () => number = secureRandom,
): null | T => {
  const total = segments.reduce((sum, s) => sum + s.weight, 0)
  if (!segments.length || !(total > 0)) return null

  let point = random() * total
  for (const segment of segments) {
    point -= segment.weight
    if (point < 0) return segment
  }
  return segments[segments.length - 1]
}

/** Uniform in [0, 1) from the operating system's CSPRNG — the odds cannot be predicted from earlier spins. */
export const secureRandom = (): number => randomInt(0, 2 ** 47) / 2 ** 47

/**
 * The code a prize becomes: `PLUM-7K4Q-X2`. Ten characters from an alphabet
 * without look-alikes (no 0/O, 1/I/L), so it can be read aloud or typed from a
 * phone — about 2 × 10^14 possibilities, far too many to guess. Uniqueness is
 * still enforced by the database; the caller retries on a clash.
 */
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'
export const newRewardCode = (pick: (n: number) => number = (n) => randomInt(0, n)): string => {
  const chars = Array.from({ length: 6 }, () => ALPHABET[pick(ALPHABET.length)])
  return `PLUM-${chars.slice(0, 4).join('')}-${chars.slice(4).join('')}`
}

/** When a prize's code stops working: `days` from now, at the end of that day in Doha (UTC+3). */
export const rewardExpiry = (days: number, now = new Date()): Date => {
  const valid = Math.max(1, Math.floor(days || 30))
  const doha = new Date(now.getTime() + 3 * 3600_000)
  doha.setUTCDate(doha.getUTCDate() + valid)
  doha.setUTCHours(23, 59, 59, 0)
  return new Date(doha.getTime() - 3 * 3600_000)
}

/** The prize in words, for the result screen and the email: "10% off", "QAR 100 off", "Free delivery". */
export const describeReward = (s: Pick<Drawable, 'rewardType' | 'rewardValue'>): string => {
  if (s.rewardType === 'percent') return `${s.rewardValue}% off`
  if (s.rewardType === 'fixed') return `QAR ${s.rewardValue} off`
  if (s.rewardType === 'freeShipping') return 'Free delivery'
  return 'Another spin'
}
