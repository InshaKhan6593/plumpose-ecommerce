'use client'

import type { User } from '@/payload-types'

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'

/**
 * The signed-in customer, and the calls that change who that is.
 *
 * Every call goes to Payload's REST auth endpoints on the same origin; the
 * session is the HTTP-only `payload-token` cookie those endpoints set, so
 * nothing here stores a token. Failures throw an `AuthError` whose `code` the
 * forms turn into words — the API's own messages are not shown to customers.
 *
 * (The template's `create`, `forgotPassword` and `resetPassword` posted to an
 * endpoint that does not exist and read GraphQL-shaped replies from REST, so
 * none of them worked.)
 */

export type AuthErrorCode = 'email-taken' | 'invalid-credentials' | 'invalid-token' | 'locked' | 'unknown'

export class AuthError extends Error {
  constructor(public code: AuthErrorCode) {
    super(code)
  }
}

type CreateArgs = { email: string; name?: string; password: string }

type AuthContext = {
  create: (args: CreateArgs) => Promise<User>
  forgotPassword: (args: { email: string }) => Promise<void>
  login: (args: { email: string; password: string }) => Promise<User>
  logout: () => Promise<void>
  resetPassword: (args: { password: string; token: string }) => Promise<User>
  setUser: (user: User | null) => void
  status: 'loggedIn' | 'loggedOut' | undefined
  /** `undefined` while the first check is in flight, `null` when signed out. */
  user?: User | null
}

const Context = createContext({} as AuthContext)

const post = (path: string, body?: unknown) =>
  fetch(`/api/users${path}`, {
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  })

/** Field-level validation errors in a Payload error reply, e.g. a duplicate email. */
const fieldErrors = async (res: Response): Promise<string[]> => {
  const json = (await res.json().catch(() => ({}))) as {
    errors?: Array<{ data?: { errors?: Array<{ path?: string }> }; message?: string }>
  }
  return (json.errors ?? []).flatMap((e) => (e.data?.errors ?? []).map((f) => f.path ?? ''))
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>()
  const [status, setStatus] = useState<'loggedIn' | 'loggedOut' | undefined>()

  const signedIn = useCallback((next: User) => {
    setUser(next)
    setStatus('loggedIn')
    return next
  }, [])

  const login = useCallback<AuthContext['login']>(
    async ({ email, password }) => {
      const res = await post('/login', { email, password })
      if (res.ok) return signedIn(((await res.json()) as { user: User }).user)
      // Payload answers 401 for a wrong password, 403 once the account is locked after repeated failures.
      throw new AuthError(res.status === 401 ? 'invalid-credentials' : res.status === 403 ? 'locked' : 'unknown')
    },
    [signedIn],
  )

  const create = useCallback<AuthContext['create']>(
    async ({ email, name, password }) => {
      const res = await post('', { email, name, password })
      if (!res.ok) {
        const fields = await fieldErrors(res)
        throw new AuthError(fields.includes('email') ? 'email-taken' : 'unknown')
      }
      return login({ email, password })
    },
    [login],
  )

  const logout = useCallback<AuthContext['logout']>(async () => {
    const res = await post('/logout')
    // Already signed out is still signed out.
    if (!res.ok && res.status !== 400) throw new AuthError('unknown')
    setUser(null)
    setStatus('loggedOut')
  }, [])

  /** Payload replies the same whether or not the address has an account, so this cannot be used to find one. */
  const forgotPassword = useCallback<AuthContext['forgotPassword']>(async ({ email }) => {
    const res = await post('/forgot-password', { email })
    if (!res.ok) throw new AuthError('unknown')
  }, [])

  const resetPassword = useCallback<AuthContext['resetPassword']>(
    async ({ password, token }) => {
      const res = await post('/reset-password', { password, token })
      if (res.ok) return signedIn(((await res.json()) as { user: User }).user)
      throw new AuthError(res.status === 403 || res.status === 400 ? 'invalid-token' : 'unknown')
    },
    [signedIn],
  )

  useEffect(() => {
    fetch('/api/users/me', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : { user: null }))
      .then(({ user: me }: { user?: User | null }) => {
        setUser(me ?? null)
        setStatus(me ? 'loggedIn' : undefined)
      })
      .catch(() => setUser(null))
  }, [])

  return (
    <Context.Provider value={{ create, forgotPassword, login, logout, resetPassword, setUser, status, user }}>
      {children}
    </Context.Provider>
  )
}

export const useAuth = (): AuthContext => useContext(Context)
