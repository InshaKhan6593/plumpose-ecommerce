import type { Payload } from 'payload'

import { getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'

/**
 * Login lockout (REQUIREMENTS A1, N6): five wrong passwords lock the account,
 * and then even the right one is refused until the lock expires. Uses a
 * throwaway customer account, removed afterwards.
 */

const EMAIL = 'e2eonly-lockout@plumpose.local'
const PASSWORD = 'correct-horse-battery'
let payload: Payload
let userId: number

beforeAll(async () => {
  payload = await getPayload({ config: await config })
  await payload.delete({ collection: 'users', overrideAccess: true, where: { email: { equals: EMAIL } } }).catch(() => undefined)
  userId = (await payload.create({ collection: 'users', data: { email: EMAIL, password: PASSWORD, roles: ['customer'] } as never, overrideAccess: true })).id
}, 120_000)

afterAll(async () => {
  await payload.delete({ collection: 'users', id: userId, overrideAccess: true }).catch(() => undefined)
})

const tryLogin = (password: string) => payload.login({ collection: 'users', data: { email: EMAIL, password } })

describe('login lockout', () => {
  it('is set to five attempts and fifteen minutes', () => {
    const auth = payload.collections.users.config.auth
    expect(auth.maxLoginAttempts).toBe(5)
    expect(auth.lockTime).toBe(15 * 60 * 1000)
  })

  it('locks the account after five wrong passwords, then refuses even the right one', async () => {
    for (let i = 0; i < 5; i++) await expect(tryLogin('wrong-password')).rejects.toThrow()
    await expect(tryLogin(PASSWORD)).rejects.toThrow(/locked/i)
  })

  it('records the lock on the account, and clears it on unlock', async () => {
    // (A successful login is not repeated here: signing its token needs Node's own crypto,
    //  which this test environment replaces. The storefront sign-in covers it end to end.)
    const locked = (await payload.findByID({ collection: 'users', id: userId, overrideAccess: true, showHiddenFields: true })) as { lockUntil?: null | string; loginAttempts?: number }
    expect(new Date(locked.lockUntil!).getTime()).toBeGreaterThan(Date.now() + 14 * 60 * 1000)
    await payload.unlock({ collection: 'users', data: { email: EMAIL } as never, overrideAccess: true })
    const open = (await payload.findByID({ collection: 'users', id: userId, overrideAccess: true, showHiddenFields: true })) as { lockUntil?: null | string; loginAttempts?: number }
    expect(open.loginAttempts ?? 0).toBe(0)
    expect(open.lockUntil ?? null).toBeNull()
  })
})
