import type { EmailAdapter } from 'payload'

import { resendAdapter } from '@payloadcms/email-resend'

import { getServerSideURL } from '@/utilities/getURL'

/**
 * Transactional email, through Resend (§5.2).
 *
 * Fixes L5 — the worst defect on the live site: the customer never received
 * anything, and the only confirmation went to `info@plumpose.com`.
 *
 * ## Environment
 *
 * | Variable               | Meaning |
 * |------------------------|---------|
 * | `RESEND_API_KEY`       | Turns email on. Empty = nothing is sent, and Payload logs emails to the console instead. |
 * | `EMAIL_FROM`           | `plumpose <orders@plumpose.com>`. The domain must be verified in Resend — until it is, use `onboarding@resend.dev`. |
 * | `EMAIL_TEST_RECIPIENT` | Optional. Redirects **every** email to this one address. For testing on an unverified Resend account, which can only deliver to the address that signed up. Never set in production. |
 *
 * Off under `NODE_ENV=test`, so the integration suite cannot send real mail.
 */

const DEFAULT_FROM = { address: 'onboarding@resend.dev', name: 'plumpose' }

/** `plumpose <orders@plumpose.com>` → name and address. A bare address is accepted too. */
export const parseFrom = (raw: string | undefined): { address: string; name: string } => {
  const value = raw?.trim().replace(/^"|"$/g, '')
  if (!value) return DEFAULT_FROM

  const match = value.match(/^(.*?)\s*<([^>]+)>$/)
  if (match) {
    return {
      address: match[2].trim(),
      name: match[1].trim().replace(/^"|"$/g, '') || DEFAULT_FROM.name,
    }
  }

  return { address: value, name: DEFAULT_FROM.name }
}

export const isEmailEnabled = (): boolean =>
  Boolean(process.env.RESEND_API_KEY) && process.env.NODE_ENV !== 'test'

/** The adapter for `buildConfig`, or `undefined` so Payload falls back to logging to the console. */
export const emailAdapter = (): EmailAdapter | undefined => {
  if (!isEmailEnabled()) return undefined

  const from = parseFrom(process.env.EMAIL_FROM)

  return resendAdapter({
    apiKey: process.env.RESEND_API_KEY || '',
    defaultFromAddress: from.address,
    defaultFromName: from.name,
    overrideRecipientAddress: process.env.EMAIL_TEST_RECIPIENT || undefined,
  })
}

/**
 * Addresses that can never receive mail.
 *
 * `.local`, `.test`, `.example`, `.invalid` and `example.com` are reserved
 * (RFC 2606 / 6761). The e2e suite checks out as `shopper@plumpose.local`;
 * without this, every test run would send its orders to
 * `EMAIL_TEST_RECIPIENT`.
 */
export const isUndeliverable = (email: string): boolean =>
  /\.(local|test|example|invalid|localhost)$/i.test(email.trim()) ||
  /@example\.(com|org|net)$/i.test(email.trim())

/** Where links in an email point. The storefront and admin share one origin. */
export const siteUrl = (): string => getServerSideURL().replace(/\/$/, '')
