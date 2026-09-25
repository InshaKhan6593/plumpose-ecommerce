/**
 * Copy for the content pages — Our Story, FAQ, Shipping & Returns, Made for
 * You, Press, Spotted, Contact, Track order.
 *
 * Two kinds of text live here, and every block says which:
 *
 *   LEGACY       — the client's own words, lifted verbatim from her old site
 *                  (`plumpose Final/plumpose-DEPLOY/index.html`). Safe to show.
 *   PLACEHOLDER  — written by us in her register so the page is complete for
 *                  review. Must be confirmed or replaced by the client before
 *                  launch (docs/CLIENT-REQUEST.md §4). Listed in
 *                  docs/BUILD-LOG.md §17.
 *
 * Every figure — prices, fees, lead times, sizes, delivery rates — comes from
 * the database at render time, never from this file.
 *
 * Like the homepage's content.ts, this is the step before an admin-editable
 * global: the shape is already one block per section, so moving it into
 * Payload later is a mechanical change.
 */

import type { Project } from '@/payload-types'

/* ------------------------------------------------------------------ Our Story */

export const OUR_STORY = {
  /** PLACEHOLDER — the opener line. */
  opener: {
    label: 'Our story',
    heading: ['For the hours', 'that belong to you'],
  },

  /** LEGACY — her footer line, word for word. */
  lede: 'Silk nightwear, hand-finished to order.',

  /**
   * PLACEHOLDER — the founder paragraph. The client has been asked for "a
   * short paragraph about you and plumpose" (CLIENT-REQUEST §4). Kept
   * deliberately general: nothing here states a fact about her we do not know.
   */
  founder: {
    label: 'The house',
    heading: 'Made in Doha, for slow evenings',
    body: [
      'plumpose began with a simple wish: to make something close to home. A set of silk nightwear you reach for at the end of the day, cut to drape rather than cling, and finished by hand in Doha.',
      'Each piece is made to order in small numbers, so nothing is made that will not be worn. It is a slower way of working — and, we think, a better one.',
    ],
  },

  /** LEGACY — "Behind the Al Shaheen Nights print", verbatim. */
  print: {
    label: 'Behind the print',
    heading: 'Al Shaheen Nights',
    body: [
      'Inspired by the seasonal gathering of whale sharks in the waters of northeastern Qatar, the Al Shaheen Nights print celebrates one of the country’s most extraordinary natural wonders. Designed as the very first plumpose Resort print, it reflects a personal desire to create something deeply connected to home — and to show the beauty of Qatar through a refined, meaningful lens.',
      'Hand-illustrated with delicate detail, the print captures the gentle movement of the sea and the quiet elegance of these majestic creatures. Flowing, ocean-inspired tones and graceful compositions evoke the feeling of warm summer evenings by the water — serene, timeless, and unmistakably Qatari.',
    ],
    signoff: 'Slip into the evening.',
    signature: 'The plumpose team',
    /** PLACEHOLDER — caption for the sea band, shown only when there is a photograph of the sea. */
    seaCaption: 'The waters of Qatar',
  },

  /**
   * LEGACY — "Why it lasts / Quietly, obsessively made", verbatim.
   * ⚠️ The old site says "pure 22-momme silk" in one place and "97% silk,
   * 3% spandex" in another. Both are hers; the client should confirm which is
   * right before launch (flagged in BUILD-LOG §17).
   */
  silk: {
    id: 'the-silk',
    label: 'The silk',
    heading: 'Quietly, obsessively made.',
    pillars: [
      {
        title: '22-momme silk',
        body: 'Heavier than most sleepwear silk. It drapes like water and wears like an heirloom.',
      },
      {
        title: 'Hand-finished seams',
        body: 'French seams throughout, finished by hand — no raw edge ever meets the skin.',
      },
      {
        title: 'A print with a place',
        body: 'The whale sharks of Al Shaheen, drawn under a Qatari night and printed onto midnight silk.',
      },
    ],
  },

  /** PLACEHOLDER — the atelier / hand-finishing band. Figures come from Site settings. */
  atelier: {
    label: 'The atelier',
    heading: 'Stitched by hand',
    body: 'Initials, a star, a crescent moon — embroidered by hand in our atelier, in the thread you choose. It is stitched exactly as typed, so it stays yours for good.',
    cta: 'Add embroidery',
  },

  closing: {
    /** LEGACY — her sign-off. */
    line: 'Slip into the evening.',
    cta: 'Shop the set',
  },
} as const

/* ------------------------------------------------------------------------ FAQ */

export const FAQ_PAGE = {
  heading: 'Questions',
  intro: 'Everything we are asked most often. If yours is not here, we usually reply within a day.',
  /** Display order and labels for the FAQs collection's categories. */
  groups: [
    { key: 'orders', label: 'Orders & payment' },
    { key: 'delivery', label: 'Delivery' },
    { key: 'returns', label: 'Returns & exchanges' },
    { key: 'personalisation', label: 'Personalisation' },
    { key: 'care', label: 'Product & care' },
  ],
} as const

/* ----------------------------------------------------------- Shipping & Returns */

export const SHIPPING_PAGE = {
  heading: 'Shipping & returns',
  /** LEGACY. */
  intro: 'We’re pleased to offer delivery across Qatar and worldwide.',
  delivery: {
    qatarHeading: 'Within Qatar',
    qatarNote: 'A flat rate by city, shown at checkout.',
    intlHeading: 'Worldwide',
    intlNote: 'A flat rate by destination, shown at checkout before you pay.',
    /** LEGACY. */
    timing:
      'Every piece is hand-finished to order. Delivery times may vary with location and customs; your order confirmation email sets out what happens next, and you can follow it from Track order.',
    currency: 'Every order is charged in Qatari Riyal. Where we show your own currency, it is a guide.',
  },
  /** LEGACY — "Returns & exchanges policy", verbatim. */
  returns: {
    heading: 'Returns & exchanges',
    intro:
      'We hope you love every piece as much as we loved creating it. If you’re not completely satisfied, we offer returns and exchanges under the following terms:',
    terms: [
      'Returns and exchanges accepted within 14 days of delivery.',
      'Items must be unworn, unwashed and in original condition, with all packaging and tags intact.',
      'For hygiene and quality, any item showing signs of wear, washing, damage or alteration cannot be accepted.',
      'Original shipping charges are non-refundable.',
      'Customers cover return shipping unless the item is faulty or incorrect.',
      'For a damaged or incorrect item, contact us within 48 hours of delivery.',
      'Approved refunds are processed to the original payment method once the return is received and inspected.',
    ],
    exceptionLabel: 'Personalised pieces',
    exception: 'Personalised or monogrammed pieces are not eligible for return or exchange.',
    contact: 'For any return or exchange enquiry, write to us or send a message on Instagram. Our team will attend to you.',
  },
  /** LEGACY — the gift packaging copy and the checkout's gift note. */
  gifting: {
    heading: 'Gift wrapping',
    body: 'Every plumpose order is presented in our signature packaging and finished with a complimentary thank-you card — ideal for gifting, or for keeping as a personal indulgence.',
    note: 'Sending it to someone else? Choose “This is a gift” at checkout and we will handwrite your message onto a plumpose card. The price is never shown inside a gift parcel.',
  },
} as const

/* -------------------------------------------------------------- Made for You */

export const MADE_FOR_YOU = {
  heading: 'Made for you',
  /** PLACEHOLDER. */
  intro: 'Bridal sets, bespoke pieces and embroidery made for one person — or for a few hundred guests.',
  /**
   * PLACEHOLDER — what she offers, one line each. These describe the
   * categories the Projects collection already has; the client should confirm
   * she takes each kind of commission.
   */
  offers: [
    {
      key: 'bridal',
      title: 'Bridal',
      body: 'A set for the morning of the wedding, and matching pieces for the bride’s closest circle — each embroidered with a name or a date.',
    },
    {
      key: 'bespoke',
      title: 'Bespoke',
      body: 'Your measurements, your length, your choice of piping. Made once, for you.',
    },
    {
      key: 'embroidery',
      title: 'Special embroidery',
      body: 'Beyond initials: a date, a word in Arabic, a motif drawn for you. Stitched by hand in our atelier.',
    },
    {
      key: 'collaboration',
      title: 'Collaborations',
      body: 'Gifting for hotels, brands and occasions — sets carrying your mark, finished to our standard.',
    },
  ],
  /** PLACEHOLDER — how a commission runs. */
  process: {
    label: 'How it works',
    steps: [
      { title: 'Tell us', body: 'Write to us with the occasion, the date and how many pieces.' },
      { title: 'We talk it through', body: 'Fabric, fit, embroidery and timing — agreed together, in writing.' },
      { title: 'Made by hand', body: 'Cut and finished in Doha. We send a photograph before it leaves.' },
      { title: 'Delivered', body: 'In our signature packaging, to you or to them.' },
    ],
  },
  enquiry: {
    heading: 'Begin a commission',
    body: 'Tell us what you have in mind. We reply within a day.',
    cta: 'Enquire',
  },
  projectsHeading: 'Recent commissions',
} as const

/** The Projects collection's categories, as the storefront names them. */
export const CATEGORY_LABELS: Record<Project['category'], string> = {
  bespoke: 'Bespoke',
  bridal: 'Bridal',
  collaboration: 'Collaboration',
  embroidery: 'Special embroidery',
  other: 'Commission',
}

/* ---------------------------------------------------------------------- Press */

export const PRESS_PAGE = {
  heading: 'Press',
  intro: 'plumpose in print and online.',
  /** Shown while there are no published press items. Nothing is invented. */
  empty: {
    heading: 'For editors and stylists',
    body: 'Samples, imagery and interviews are available on request. Write to us and we will reply within a day.',
    cta: 'Press enquiries',
  },
} as const

/* -------------------------------------------------------------------- Spotted */

export const SPOTTED_PAGE = {
  heading: 'Spotted',
  intro: 'plumpose, as you wear it.',
  invite: {
    heading: 'Share yours',
    body: 'Tag us on Instagram. With your permission, we may share your photograph here.',
  },
  /** PLACEHOLDER — ours, to confirm. The form on the page (REQUIREMENTS S15). */
  form: {
    heading: 'Send us yours',
    body: 'A photograph of you in plumpose. We look at every one before it appears.',
  },
  /** Shown while no customer photographs are approved — the brand's own, labelled as such. */
  empty: {
    label: 'From the Resort 2026 campaign',
    body: 'The first photographs from you will appear here.',
  },
} as const

/* -------------------------------------------------------------------- Contact */

export const CONTACT_PAGE = {
  heading: 'Contact',
  /** LEGACY — the old site's "Get in touch" modal. */
  intro: 'How would you like to reach us? Our team usually replies within a day. Choose whichever is easiest.',
  formHeading: 'Write to us',
  subjects: ['An order', 'Sizing & fit', 'Personalisation', 'Made for you', 'Press', 'Something else'],
  thanks: {
    heading: 'Thank you.',
    body: 'Your message is with us. We usually reply within a day.',
  },
} as const

/* ---------------------------------------------------------------- Track order */

export const TRACK_PAGE = {
  heading: 'Track your order',
  intro: 'Enter the email you ordered with and your order number. We will email you a private link to your order and where it is.',
  sent: {
    heading: 'Check your email',
    body: 'If an order matches those details, a link to it is on its way. It can take a minute to arrive.',
  },
} as const

/* ---------------------------------------------------------------------- Media */

/**
 * The photographs each page uses, by filename in the Media library (seeded
 * from brand-assets/product/ — see src/seed/index.ts). Same scheme as the
 * homepage's HOME_MEDIA.
 */
export const PAGE_MEDIA = {
  armchair: 'brand-05-armchair.jpg',
  corridor: 'brand-04-corridor.jpg',
  doorway: 'brand-06-doorway.jpg',
  piping: 'brand-03-piping.jpg',
  print: 'brand-02-print-macro.jpg',
  qatarBook: 'brand-07-qatar-book.jpg',
  window: 'brand-01-window.jpg',
} as const

export type PageMediaKey = keyof typeof PAGE_MEDIA

/**
 * Slots for AI-generated **test** photographs (docs/TEST-SHOTS.md), used only
 * while `TEST_SHOTS=on` and only once `pnpm test-shots` has imported them.
 * Until then — and always in production — the real photograph above is used.
 * Each slot names the real photograph it stands in for.
 */
export const PAGE_TEST_MEDIA = {
  /** Our Story, the house band — founder-style portrait. Stands in for `doorway`. */
  founder: 'test-our-story-portrait.jpg',
  /** Our Story atelier band; Made for You hero. Stands in for `piping`. */
  atelier: 'test-atelier-hands.jpg',
  /** Made for You "Special embroidery"; FAQ personalisation. Stands in for `piping`. */
  embroidery: 'test-embroidery-initials.jpg',
  /** Shipping & Returns, gift wrapping. Stands in for `qatarBook`. */
  packaging: 'test-packaging.jpg',
  /** Our Story, a wide band of the sea after "behind the print". No real photograph yet — the band waits for one. */
  sea: 'test-doha-sea.jpg',
  /** The print, wide. Stands in for `print` in landscape frames. */
  printWide: 'test-print-wide.jpg',
} as const

export type PageTestKey = keyof typeof PAGE_TEST_MEDIA
