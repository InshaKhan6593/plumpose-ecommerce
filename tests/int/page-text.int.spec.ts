import type { Payload } from 'payload'

import { getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import { HOME } from '@/components/home/content'
import { MADE_FOR_YOU, OUR_STORY, SHIPPING_PAGE } from '@/content/pages'
import { italicsToText, mergePageText, textToItalics } from '@/content/pageTextSchema'

/** Page text (REQUIREMENTS S1, A18): her words over the defaults, and never a blank page. */

describe('page text — the merge', () => {
  it('with nothing saved, every page reads exactly as the defaults', () => {
    const merged = mergePageText(null)
    expect(merged.HOME).toEqual(HOME)
    expect(merged.OUR_STORY).toEqual(OUR_STORY)
    expect(merged.SHIPPING_PAGE).toEqual(SHIPPING_PAGE)
  })

  it('takes each kind of field in her words', () => {
    const merged = mergePageText({
      home: {
        hero: { cta: '  Shop the silk ', tagline: 'Sleep\n  beautifully. \n' },
        philosophy: { headline: 'Made for the *quiet hours* of the night.' },
      },
      madeForYou: {
        offers: { bridal: { title: 'Weddings' } },
        process: {
          steps: [
            { body: 'Write to us.', title: 'One' },
            { body: '', title: '' },
          ],
        },
      },
      ourStory: { founder: { body: 'First paragraph\nstill first.\n\n\nSecond paragraph.' } },
      shipping: { returns: { terms: 'Fourteen days.\nUnworn only.' } },
    })
    expect(merged.HOME.hero.cta).toBe('Shop the silk')
    expect(merged.HOME.hero.tagline).toEqual(['Sleep', 'beautifully.'])
    expect(merged.HOME.philosophy.headline).toEqual([
      { text: 'Made for the ' },
      { italic: true, text: 'quiet hours' },
      { text: ' of the night.' },
    ])
    expect(merged.OUR_STORY.founder.body).toEqual([
      'First paragraph still first.',
      'Second paragraph.',
    ])
    expect(merged.SHIPPING_PAGE.returns.terms).toEqual(['Fourteen days.', 'Unworn only.'])
    // A keyed item keeps its key and any words she did not change.
    expect(merged.MADE_FOR_YOU.offers[0]).toEqual({ ...MADE_FOR_YOU.offers[0], title: 'Weddings' })
    expect(merged.MADE_FOR_YOU.offers.map((o) => o.key)).toEqual(
      MADE_FOR_YOU.offers.map((o) => o.key),
    )
    // An empty row she added is dropped.
    expect(merged.MADE_FOR_YOU.process.steps).toEqual([{ body: 'Write to us.', title: 'One' }])
  })

  it('an emptied field goes back to the default, never blank', () => {
    const merged = mergePageText({
      home: { hero: { cta: '   ', tagline: '\n\n' } },
      ourStory: { silk: { pillars: [] } },
    })
    expect(merged.HOME.hero.cta).toBe(HOME.hero.cta)
    expect(merged.HOME.hero.tagline).toEqual(HOME.hero.tagline)
    expect(merged.OUR_STORY.silk.pillars).toEqual(OUR_STORY.silk.pillars)
  })

  it('writes and reads italics the same way', () => {
    const text = italicsToText(HOME.philosophy.headline)
    expect(text).toBe(
      'Inspired by the *tranquil waters* of Qatar and the *seasonal gathering* of whale sharks.',
    )
    expect(textToItalics(text)).toEqual(HOME.philosophy.headline)
    // An unclosed asterisk is just an asterisk.
    expect(textToItalics('A *star')).toEqual([{ text: 'A *star' }])
  })
})

describe('page text — saved in the admin', () => {
  let payload: Payload
  let before: Record<string, unknown>

  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    before = (await payload.findGlobal({ depth: 0, slug: 'pageText' })) as unknown as Record<
      string,
      unknown
    >
  }, 120_000)

  afterAll(async () => {
    const {
      createdAt: _c,
      globalType: _g,
      id: _i,
      updatedAt: _u,
      ...data
    } = before as Record<string, unknown>
    await payload.updateGlobal({
      context: { disableRevalidate: true },
      data: data as never,
      slug: 'pageText',
    })
  })

  it('starts filled with today’s text, so she edits rather than writes from nothing', () => {
    const home = before.home as { hero?: { cta?: string; tagline?: string } }
    expect(home?.hero?.cta).toBe(HOME.hero.cta)
    expect(home?.hero?.tagline).toBe(HOME.hero.tagline.join('\n'))
  })

  it('what she saves is what the page gets', async () => {
    await payload.updateGlobal({
      context: { disableRevalidate: true },
      data: {
        home: { hero: { cta: 'See the set', tagline: 'Rest\nbeautifully.' } },
        press: { heading: 'In the press' },
      } as never,
      slug: 'pageText',
    })
    const merged = mergePageText(
      (await payload.findGlobal({ depth: 0, slug: 'pageText' })) as unknown as Record<
        string,
        unknown
      >,
    )
    expect(merged.HOME.hero.cta).toBe('See the set')
    expect(merged.HOME.hero.tagline).toEqual(['Rest', 'beautifully.'])
    expect(merged.PRESS_PAGE.heading).toBe('In the press')
    // Untouched pages keep their words.
    expect(merged.OUR_STORY.opener).toEqual(OUR_STORY.opener)
  })
})
