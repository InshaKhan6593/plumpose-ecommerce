import configPromise from '@payload-config'
import { headers as getHeaders } from 'next/headers.js'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import { noticeHref } from './notices'

/** The signed-in user for this request, or null. */
export const getSessionUser = async () => {
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: await getHeaders() })
  return { payload, user }
}

/**
 * For account pages: the signed-in user, or a redirect to sign in that comes
 * back to `path` afterwards.
 */
export const requireUser = async (path: string) => {
  const session = await getSessionUser()
  if (!session.user) redirect(noticeHref('/login', 'sign-in-first', { redirect: path }))
  return { payload: session.payload, user: session.user }
}

/** For sign-in and create-account: a signed-in visitor goes to their account instead. */
export const redirectIfSignedIn = async () => {
  const { user } = await getSessionUser()
  if (user) redirect(noticeHref('/account', 'signed-in-already'))
}
