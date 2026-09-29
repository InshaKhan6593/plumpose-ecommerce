import { describe, expect, it } from 'vitest'

import { analyticsUrl } from '@/utilities/analyticsUrl'

describe('analyticsUrl — what Google Analytics is told', () => {
  it('drops the order page token, and the placed flag', () => {
    expect(
      analyticsUrl('https://plumpose.com/order/12?placed=1&token=f05b206a-9544-47b8-81cf-42f54b4c382a'),
    ).toBe('https://plumpose.com/order/12')
  })

  it('drops a password reset token', () => {
    expect(analyticsUrl('https://plumpose.com/reset-password?token=abc123')).toBe(
      'https://plumpose.com/reset-password',
    )
  })

  it("drops SkipCash's payment id on the return page", () => {
    expect(analyticsUrl('https://plumpose.com/checkout/return?id=9f1c&statusId=2')).toBe(
      'https://plumpose.com/checkout/return',
    )
  })

  it('keeps campaign parameters, and only those', () => {
    expect(
      analyticsUrl(
        'https://plumpose.com/shop?utm_source=instagram&utm_medium=bio&email=a%40b.com&gclid=xyz#top',
      ),
    ).toBe('https://plumpose.com/shop?utm_source=instagram&utm_medium=bio&gclid=xyz')
  })

  it('leaves a plain address as it is, and gives nothing for an empty referrer', () => {
    expect(analyticsUrl('https://plumpose.com/products/al-shaheen-nights')).toBe(
      'https://plumpose.com/products/al-shaheen-nights',
    )
    expect(analyticsUrl('')).toBe('')
  })
})
