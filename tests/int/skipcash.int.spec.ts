// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { createPayment, getPayment, skipcashConfig } from '@/payments/skipcash/api'
import {
  ADDRESS_BUDGET,
  isPaymentId,
  minorFromSkipcash,
  newReference,
  PAYMENT_SIGNED_FIELDS,
  signingString,
  signPayment,
  skipcashAddress,
  skipcashAmount,
  skipcashName,
  skipcashPhone,
  statusName,
  webhookSignatureValid,
} from '@/payments/skipcash/protocol'
import { skipcashEvent } from '@/payments/skipcash/webhook'

/**
 * SkipCash's wire protocol (REQUIREMENTS §7.2 — "the most brittle part of the
 * integration"). The expected signatures below were computed with the old
 * site's own `netlify/lib/skipcash.mjs`, an independent implementation that
 * ran against the same API, so these are not this code checking itself.
 */

describe('skipcash — payment signature', () => {
  const body = {
    Uid: '8d1f4b5e-2c3a-4e7f-9a0b-1c2d3e4f5a6b',
    KeyId: '11111111-2222-3333-4444-555555555555',
    Amount: '1579.00',
    FirstName: 'Mariam',
    LastName: 'Al Thani',
    Phone: '+97455512345',
    Email: 'mariam@example.com',
    Street: '',
    City: 'Doha',
    Country: 'QA',
    TransactionId: 'PLM-260925-ACDEFG',
  }

  it('matches the old site’s signature for the same request', () => {
    expect(signPayment('test-secret', body)).toBe('lF+FFMNNFIT6V+/3Qa5wujFlsanL/HpFdPLzZnIQR0A=')
  })

  it('signs in SkipCash’s fixed order, skipping empty fields, whatever order the body is in', () => {
    const shuffled = Object.fromEntries(Object.entries(body).reverse())
    expect(signingString(PAYMENT_SIGNED_FIELDS, shuffled)).toBe(
      'Uid=8d1f4b5e-2c3a-4e7f-9a0b-1c2d3e4f5a6b,KeyId=11111111-2222-3333-4444-555555555555,' +
        'Amount=1579.00,FirstName=Mariam,LastName=Al Thani,Phone=+97455512345,' +
        'Email=mariam@example.com,City=Doha,Country=QA,TransactionId=PLM-260925-ACDEFG',
    )
  })

  it('signs Custom1 but none of the unsigned fields', () => {
    const extra = {
      ...body,
      Custom1: 'one',
      Custom2: 'two',
      Description: 'd',
      ReturnUrl: 'https://plumpose.com/checkout/return',
      Subject: 's',
      WebhookUrl: 'https://plumpose.com/api/payments/skipcash/webhooks',
    }
    const signed = signingString(PAYMENT_SIGNED_FIELDS, extra)
    expect(signed.endsWith(',TransactionId=PLM-260925-ACDEFG,Custom1=one')).toBe(true)
    expect(signed).not.toMatch(/Custom2|Description|ReturnUrl|Subject|WebhookUrl/)
  })
})

describe('skipcash — webhook signature', () => {
  const key = 'e79c-test-webhook-key'
  const callback = {
    PaymentId: 'c0168532-8e71-4623-b73a-c06db5cbd865',
    Amount: '1579.00',
    StatusId: 2,
    TransactionId: 'PLM-260925-ACDEFG',
    Custom1: null,
    Custom2: null,
    VisaId: '07082024100903646560',
    TokenId: 'NA',
    CardType: 'Debit Card',
  }
  const genuine = 'xRXah95aDO+hA/+4cd6/jblJMtR6eaDM5IXmwLL/oew='

  it('accepts a callback signed with the Webhook Key', () => {
    expect(webhookSignatureValid(key, callback, genuine)).toBe(true)
  })

  it('refuses one whose amount, status or payment was changed', () => {
    expect(webhookSignatureValid(key, { ...callback, Amount: '1.00' }, genuine)).toBe(false)
    expect(webhookSignatureValid(key, { ...callback, StatusId: 4 }, genuine)).toBe(false)
    expect(
      webhookSignatureValid(key, { ...callback, TransactionId: 'PLM-260925-OTHER1' }, genuine),
    ).toBe(false)
  })

  it('refuses a wrong key, a missing signature and a missing key', () => {
    expect(webhookSignatureValid('another-key', callback, genuine)).toBe(false)
    expect(webhookSignatureValid(key, callback, '')).toBe(false)
    expect(webhookSignatureValid(key, callback, null)).toBe(false)
    expect(webhookSignatureValid('', callback, genuine)).toBe(false)
    expect(webhookSignatureValid(key, callback, 'short')).toBe(false)
  })

  it('ignores fields SkipCash does not sign', () => {
    expect(webhookSignatureValid(key, { ...callback, CardType: 'Apple Pay' }, genuine)).toBe(true)
  })
})

describe('skipcash — request fields', () => {
  it('sends QAR as a two-decimal string, and reads it back exactly', () => {
    expect(skipcashAmount(157900)).toBe('1579.00')
    expect(skipcashAmount(141950)).toBe('1419.50')
    expect(skipcashAmount(100)).toBe('1.00')
    expect(minorFromSkipcash('1579.00')).toBe(157900)
    expect(minorFromSkipcash('1419.5')).toBe(141950)
    expect(minorFromSkipcash(' 20 ')).toBe(2000)
  })

  it('never lets a malformed amount match a real one', () => {
    for (const bad of ['', null, undefined, '1,579.00', '-1.00', '1.005', 'abc', '1e3']) {
      expect(minorFromSkipcash(bad)).toBeNull()
    }
  })

  it('keeps names to letters, in any script', () => {
    expect(skipcashName('Mariam', 'Customer')).toBe('Mariam')
    expect(skipcashName("O'Brien-Smith", 'Customer')).toBe("O'Brien-Smith")
    expect(skipcashName('مريم', 'Customer')).toBe('مريم')
    expect(skipcashName('Anne (Annie) #2', 'Customer')).toBe('Anne Annie')
    expect(skipcashName('!!!', 'Customer')).toBe('Customer')
    expect(skipcashName('x'.repeat(80), 'Customer')).toHaveLength(60)
  })

  it('gives every phone number its country code, with + and never 00', () => {
    expect(skipcashPhone('5551 2345', 'QA')).toBe('+97455512345')
    expect(skipcashPhone('+974 5551 2345', 'QA')).toBe('+97455512345')
    expect(skipcashPhone('00974 5551 2345', 'QA')).toBe('+97455512345')
    expect(skipcashPhone('07700 900123', 'GB')).toBe('+447700900123')
    expect(skipcashPhone('447700900123', 'GB')).toBe('+447700900123')
    expect(skipcashPhone('(212) 555-0147', 'US')).toBe('+12125550147')
    expect(skipcashPhone('+971 50 123 4567', 'QA')).toBe('+971501234567')
    expect(skipcashPhone('', 'QA')).toBe('')
  })

  it('never sends a phone number longer than 15', () => {
    expect(skipcashPhone('+1234567890123456789', 'QA').length).toBeLessThanOrEqual(15)
  })

  it('fits the address into SkipCash’s 50 characters, country and city first', () => {
    const long = skipcashAddress({
      addressLine1: 'Villa 12, Street 845, Zone 66, Al Waab, near the big roundabout',
      city: 'Al Rayyan',
      country: 'qa',
      postalCode: '',
    })
    const total = Object.values(long).join('').length
    expect(total).toBeLessThanOrEqual(ADDRESS_BUDGET)
    expect(long.Country).toBe('QA')
    expect(long.City).toBe('Al Rayyan')
    expect(long.Street).toMatch(/^Villa 12 Street 845/)
    expect(long.PostalCode).toBeUndefined()
  })

  it('keeps a short postcode, and drops one SkipCash would refuse', () => {
    expect(
      skipcashAddress({ addressLine1: '1 High St', city: 'Bath', country: 'GB', postalCode: 'BA1' })
        .PostalCode,
    ).toBe('BA1')
    expect(
      skipcashAddress({
        addressLine1: '1 High St',
        city: 'London',
        country: 'GB',
        postalCode: 'SW1A 1AA',
      }).PostalCode,
    ).toBeUndefined()
  })

  it('takes commas and "=" out of every value, since they would break the signature', () => {
    const address = skipcashAddress({
      addressLine1: 'Flat 2, a=b',
      city: 'Doha, Qatar',
      country: 'QA',
      postalCode: '',
    })
    expect(Object.values(address).join('')).not.toMatch(/[,=]/)
  })

  it('makes a fresh, unguessable reference of letters, digits and hyphens', () => {
    const refs = new Set(Array.from({ length: 200 }, () => newReference(new Date('2026-09-25'))))
    expect(refs.size).toBe(200)
    for (const ref of refs) {
      expect(ref).toMatch(/^PLM-260925-[A-Z0-9]{6}$/)
      expect(ref.length).toBeLessThanOrEqual(40)
    }
  })

  it('recognises SkipCash payment ids', () => {
    expect(isPaymentId('2fbe5049-a858-4973-a1d2-af50bbff39b9')).toBe(true)
    expect(isPaymentId('cs_test_123')).toBe(false)
    expect(isPaymentId("2fbe5049-a858-4973-a1d2-af50bbff39b9' or 1=1")).toBe(false)
    expect(isPaymentId(undefined)).toBe(false)
  })

  it('names statuses the way the webhook log records them', () => {
    expect(statusName(2)).toBe('paid')
    expect(skipcashEvent(4)).toBe('skipcash.failed')
    expect(skipcashEvent(5)).toBe('skipcash.rejected')
    expect(skipcashEvent(12)).toBe('skipcash.paying-now')
    expect(skipcashEvent(99)).toBe('skipcash.status-99')
  })
})

/**
 * Against SkipCash's real sandbox, with the keys in `.env`. Proves the
 * signature is accepted and a payment can be read back — the one thing no
 * fixture can. Skipped without sandbox keys; never runs against production.
 */
const config = skipcashConfig()
const live = config.isSandbox && Boolean(config.keySecret && config.keyId && config.clientId)

describe.skipIf(!live)('skipcash — the sandbox itself', () => {
  it('accepts a signed payment and reports it back as new and unpaid', async () => {
    const reference = newReference()
    const created = await createPayment(config, {
      Amount: '1.00',
      City: 'Doha',
      Country: 'QA',
      Email: `testonly-${Date.now()}@plumpose.local`,
      FirstName: 'Testonly',
      LastName: 'Integration',
      Phone: skipcashPhone(`55${String(Date.now()).slice(-6)}`, 'QA'),
      TransactionId: reference,
    })
    expect(created.payUrl).toMatch(/^https:\/\/skipcashtest\.azurewebsites\.net\/pay\//)
    expect(isPaymentId(created.id)).toBe(true)

    const read = await getPayment(config, created.id)
    expect(read?.transactionId).toBe(reference)
    expect(read?.statusId).toBe(0)
    expect(minorFromSkipcash(read?.amount)).toBe(100)
  }, 60_000)

  it('refuses a payment signed with the wrong secret', async () => {
    await expect(
      createPayment(
        { ...config, keySecret: 'not-the-secret' },
        {
          Amount: '1.00',
          Email: `testonly-${Date.now()}@plumpose.local`,
          FirstName: 'Testonly',
          LastName: 'Integration',
          Phone: '+97455500000',
          TransactionId: newReference(),
        },
      ),
    ).rejects.toThrow()
  }, 60_000)

  it('does not know a payment id it never issued', async () => {
    expect(await getPayment(config, '00000000-0000-4000-8000-000000000000')).toBeNull()
  }, 60_000)
})
