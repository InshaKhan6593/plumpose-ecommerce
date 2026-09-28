import type { Payload } from 'payload'

import { getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import { SHIPPING_PAGE } from '@/content/pages'
import { mergePageText } from '@/content/pageTextSchema'
import { replaceInText } from '@/hooks/syncReturnDays'

/**
 * Shipping & returns in her words, all of it editable in Page text, and the
 * returns window set once in Site settings (BUILD-LOG §56).
 */

const answer = (text: string) => ({
  root: {
    children: [
      {
        children: [{ detail: 0, format: 0, mode: 'normal', style: '', text, type: 'text', version: 1 }],
        direction: 'ltr',
        format: '',
        indent: 0,
        textFormat: 0,
        type: 'paragraph',
        version: 1,
      },
    ],
    direction: 'ltr',
    format: '',
    indent: 0,
    type: 'root',
    version: 1,
  },
})
const textOf = (value: unknown) => JSON.stringify(value).match(/"text":"([^"]*)"/)?.[1]

describe('shipping text — every section editable', () => {
  it('reads as the defaults with nothing saved', () => {
    expect(mergePageText(null).SHIPPING_PAGE).toEqual(SHIPPING_PAGE)
  })

  it('takes her words in each new section', () => {
    const { SHIPPING_PAGE: page } = mergePageText({
      shipping: {
        customs: { body: 'Duties are paid by you.' },
        deliveryInfo: { contact: 'Message us any time.' },
        preparation: { body: 'Two days.\n\nLonger at Eid.', heading: 'Preparing' },
        returns: {
          more: [{ body: 'Paid back in full.\n\nWithin a week.', title: 'Refunds' }],
          notAccepted: 'Otherwise, no.',
          requestBody: 'Write within {days} days.',
          requestHeading: 'Asking',
        },
      },
    })
    expect(page.preparation).toEqual({ body: ['Two days.', 'Longer at Eid.'], heading: 'Preparing' })
    expect(page.customs.body).toBe('Duties are paid by you.')
    expect(page.customs.heading).toBe(SHIPPING_PAGE.customs.heading)
    expect(page.deliveryInfo.contact).toBe('Message us any time.')
    expect(page.returns.notAccepted).toBe('Otherwise, no.')
    expect(page.returns.requestHeading).toBe('Asking')
    expect(page.returns.requestBody).toBe('Write within {days} days.')
    expect(page.returns.more).toEqual([{ body: 'Paid back in full.\n\nWithin a week.', title: 'Refunds' }])
  })

  it('keeps the defaults where she leaves a field or every row empty', () => {
    const { SHIPPING_PAGE: page } = mergePageText({
      shipping: { preparation: { body: '  ' }, returns: { more: [{ body: '', title: '' }], requestBody: '' } },
    })
    expect(page.preparation.body).toEqual(SHIPPING_PAGE.preparation.body)
    expect(page.returns.more).toEqual(SHIPPING_PAGE.returns.more)
    expect(page.returns.requestBody).toBe(SHIPPING_PAGE.returns.requestBody)
  })

  it('the request text carries the days from Site settings', () => {
    expect(SHIPPING_PAGE.returns.requestBody).toContain('{days}')
  })
})

describe('return days — FAQs follow Site settings', () => {
  it('changes "within <old> days" and nothing else', () => {
    const pattern = /\bwithin 14 days\b/gi
    const { changed, value } = replaceInText(
      answer('Returns within 14 days of delivery; delivered within 14 business days; within 140 days.'),
      pattern,
      'within 21 days',
    )
    expect(changed).toBe(true)
    expect(textOf(value)).toBe(
      'Returns within 21 days of delivery; delivered within 14 business days; within 140 days.',
    )
  })

  it('reports no change when the answer does not mention it', () => {
    const { changed } = replaceInText(answer('Cold wash only.'), /\bwithin 14 days\b/gi, 'within 21 days')
    expect(changed).toBe(false)
  })
})

describe('return days — against the database', () => {
  let payload: Payload
  let faqId: number | undefined
  let before: number

  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    const settings = await payload.findGlobal({ slug: 'siteSettings' })
    before = settings.returnWindowDays ?? 14
    const faq = await payload.create({
      collection: 'faqs',
      context: { disableRevalidate: true },
      data: {
        answer: answer(`TESTONLY — may be returned within ${before} days of delivery.`) as never,
        category: 'returns',
        published: true,
        question: 'TESTONLY return window',
      },
    })
    faqId = faq.id
  }, 120_000)

  afterAll(async () => {
    await payload.updateGlobal({
      context: { disableRevalidate: true },
      data: { returnWindowDays: before },
      slug: 'siteSettings',
    })
    if (faqId) await payload.delete({ collection: 'faqs', id: faqId, trash: false })
  })

  it('an FAQ says the new number once Site settings is saved', async () => {
    const next = before === 21 ? 30 : 21
    await payload.updateGlobal({
      context: { disableRevalidate: true },
      data: { returnWindowDays: next },
      slug: 'siteSettings',
    })
    const faq = await payload.findByID({ collection: 'faqs', id: faqId! })
    expect(textOf(faq.answer)).toBe(`TESTONLY — may be returned within ${next} days of delivery.`)
  })
})
