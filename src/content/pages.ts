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

  /** Removed at her request (27 Sep 2026); empty shows no line. */
  lede: '',

  /**
   * Hers — the founder paragraph from her corrections of 27 Sep 2026. The
   * pieces are designed in Doha, not made there ("Made in Doha" was wrong).
   */
  founder: {
    label: 'The house',
    heading: 'Designed in Doha, for slow moments',
    body: [
      'plumpose began with a simple wish: to create something that felt close to home. Something beautiful to reach for at the end of the day. Something soft against the skin, effortless to wear, and made for moments that belong entirely to you.',
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
        body: 'Heavier than most silkwear. It drapes like water and wears like an heirloom.',
      },
      {
        title: 'Hand-finished seams',
        body: 'No raw edge ever meets the skin.',
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

/**
 * Hers — "Shipping & Delivery" and "Returns, Exchanges & Refunds", sent
 * 28 Sep 2026, edited lightly to sit on the page: the fees stay in the live
 * tables, her "[your email]" is the contact email from Site settings, and her
 * "[X days]" is Site settings → Returns (14, from her old policy). Her "Sale items"
 * section had no policy in it yet, so it is not shown.
 *
 * Every part is editable in Page text → Shipping & returns (pageTextSchema.ts).
 */
export const SHIPPING_PAGE = {
  heading: 'Shipping & returns',
  intro: 'At plumpose, every order is carefully prepared before making its way to you.',
  preparation: {
    heading: 'Order preparation',
    body: [
      'Ready-to-ship orders are generally prepared and dispatched within 2–4 business days after your order is confirmed.',
      'During launches, special projects, promotions or periods of high demand, preparation times may occasionally be longer. If this applies to your order, we will communicate the expected timeframe.',
    ],
  },
  delivery: {
    qatarHeading: 'Within Qatar',
    qatarNote: 'A flat rate by city, shown at checkout. Delivery times depend on your destination.',
    intlHeading: 'GCC & worldwide',
    intlNote:
      'A flat rate by destination, shown at checkout before you pay. International orders are generally delivered within 14 business days after dispatch.',
    timing:
      'Delivery estimates do not include delays caused by customs clearance, public holidays, incorrect delivery information, courier disruptions or circumstances outside our control.',
    currency:
      'Every order is charged in Qatari Riyal. Where we show your own currency, it is a guide.',
  },
  customs: {
    heading: 'Customs & duties',
    body: 'International and GCC orders may be subject to customs duties, taxes or other import charges imposed by the destination country. Any such charges are the responsibility of the customer unless otherwise stated at checkout.',
  },
  deliveryInfo: {
    heading: 'Delivery information',
    body: 'Please make sure your delivery address and contact details are accurate before completing your order. We cannot be responsible for delays caused by incorrect or incomplete delivery information.',
    contact: 'For questions about an order or its delivery, message us on WhatsApp.',
  },
  returns: {
    heading: 'Returns & exchanges',
    intro:
      'We want you to love your plumpose piece. Because our garments are delicate and carefully prepared, returns and exchanges have specific conditions. To be eligible, items must:',
    terms: [
      'Be unused and unworn',
      'Be unwashed',
      'Be in their original condition',
      'Have all original tags and packaging attached',
      'Show no signs of perfume, makeup, stains, damage or alteration',
    ],
    notAccepted: 'Items that do not meet these conditions may not be accepted.',
    requestHeading: 'Requesting a return or exchange',
    /** `{days}` is Site settings → Returns → Days to ask for a return. */
    requestBody:
      'Contact us within {days} days of receiving your order, with your order number and the reason for your request. Once your request has been reviewed and approved, we will send you instructions for the return.',
    exceptionLabel: 'Personalised pieces',
    exception:
      'Custom-made, personalised, altered or specially commissioned pieces are generally non-returnable unless they arrive damaged or defective. For hygiene and product-integrity reasons, certain other items may not be eligible either.',
    /** Title and words per block; a blank line in the words starts a new paragraph. */
    more: [
      {
        title: 'Refunds',
        body: 'Once an approved return has been received and inspected, we will let you know the outcome.\n\nApproved refunds are issued to the original payment method, subject to its processing times. Original shipping fees may be non-refundable unless the item you received was incorrect, damaged or defective.',
      },
      {
        title: 'Exchanges',
        body: 'Exchanges are subject to stock availability. If the replacement you would like is unavailable, we may offer an alternative or a refund under this policy.',
      },
      {
        title: 'Damaged or incorrect items',
        body: 'If your order arrives damaged, or you receive the wrong item, contact us as soon as possible with your order number and clear photographs of the item and its packaging. We will review it and work with you to put it right.',
      },
    ],
    contact: 'For returns, exchanges or refunds, write to us:',
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
  /** Hers — the page's opening, from her corrections of 27 Sep 2026. */
  heading: 'Made for your moment',
  intro:
    'Some moments call for something a little more personal. From bridal mornings and bespoke embroidery to private commissions and creative collaborations, plumpose creates silk pieces designed around the occasion.',
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
      {
        title: 'We talk it through',
        body: 'Fabric, fit, embroidery and timing — agreed together, in writing.',
      },
      {
        title: 'Made by hand',
        body: 'Finished by hand. We send a photograph before it leaves.',
      },
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
  intro:
    'How would you like to reach us? Our team usually replies within a day. Choose whichever is easiest.',
  formHeading: 'Write to us',
  subjects: [
    'An order',
    'Sizing & fit',
    'Personalisation',
    'Made for you',
    'Press',
    'Something else',
  ],
  thanks: {
    heading: 'Thank you.',
    body: 'Your message is with us. We usually reply within a day.',
  },
} as const

/* ---------------------------------------------------------------- Track order */

export const TRACK_PAGE = {
  heading: 'Track your order',
  intro:
    'Enter the email you ordered with and your order code (it begins PLM-). We will email you a private link to your order and where it is.',
  sent: {
    heading: 'Check your email',
    body: 'If an order matches those details, a link to it is on its way. It can take a minute to arrive.',
  },
} as const

/* ------------------------------------------------------------ Fabric & care */

/**
 * Hers, verbatim — typed in her notes of 28 Sep 2026 ("Note 27 Sep 2026.pdf",
 * page 1), to replace the old dry-clean / 30°C care text. Laid out after the
 * fabric block she pointed at on brahmaki.com: name, spec line, an italic
 * line, a paragraph, the points, then care in one line and a link to the full
 * guidance. Shown on every product page and at the top of /fabric-care.
 */
export const FABRIC = {
  label: 'plumpose — silk, made to be felt',
  heading: '22 momme silk',
  lede: 'There are fabrics you wear — and fabrics you feel.',
  body: 'A smooth, fluid silk selected for the way it moves against the skin. With a soft lustre and naturally breathable feel, it brings an effortless sense of luxury to slow mornings, evenings at home, and everywhere in between.',
  points: [
    '22 momme for a substantial, luxurious hand feel',
    'Smooth, soft & naturally lustrous',
    'Breathable and lightweight against the skin',
    'Fluid drape designed to move with the body',
    'Made with silk for a naturally elevated feel',
    'Finished with subtle stretch for ease and comfort',
  ],
  care: {
    label: 'Care',
    intro: 'Gentle care for beautiful silk.',
    line: 'Cold wash only · mild detergent · wash inside out · do not bleach · dry flat in shade · iron on low heat · do not tumble dry',
    link: 'Full fabric & care guidance',
  },
} as const

/**
 * /fabric-care — the full guidance the product page links to. Hers, "Wash &
 * Care — the plumpose ritual", sent 28 Sep 2026, lightly edited.
 */
export const CARE_PAGE = {
  label: 'Wash & care',
  heading: 'The plumpose ritual',
  intro:
    'Our pieces are made from delicate fabrics chosen for their softness, fluidity and beauty. With a little care, your plumpose piece can remain beautiful for years to come.',
  steps: [
    {
      title: 'Wash with care',
      body: [
        'For silk and other delicate fabrics, we recommend professional dry cleaning, or gentle hand washing where the care label permits.',
        'If machine washing is permitted, place the garment in a protective laundry bag and choose a delicate cycle. Wash separately, or with similar colours.',
      ],
    },
    {
      title: 'Keep it cool',
      body: [
        'Use cold water. Avoid hot water, harsh detergents, bleach and fabric softeners: heat and strong chemicals can affect delicate fibres, colour and prints.',
      ],
    },
    {
      title: 'Dry gently',
      body: [
        'Do not tumble dry. Gently press out excess water without wringing or twisting, then lay the piece flat on a clean towel to dry, away from direct sunlight and heat.',
      ],
    },
    {
      title: 'Iron with care',
      body: [
        'Iron inside out at the lowest suitable temperature. For silk, place a clean cloth between the iron and the garment.',
        'Steaming on a gentle setting may also suit, if the care label allows it.',
      ],
    },
    {
      title: 'Let it breathe',
      body: [
        'Natural fabrics absorb the scents around them. Before washing, try airing your piece in a cool, well-ventilated space.',
        'Avoid spraying perfume, oils or alcohol-based products directly onto the fabric.',
      ],
    },
  ],
  why: {
    heading: 'Why gentle care matters',
    body: [
      'Natural fibres respond to heat, moisture and friction. Even pre-washed fabrics may change in shape or size when exposed to heat or the wrong washing.',
      'Shrinkage, colour change or damage caused by incorrect washing, drying, ironing or care is not a manufacturing defect, and may not be covered by our returns policy.',
    ],
  },
  store: {
    heading: 'Store with care',
    body: [
      'Keep your pieces clean, dry and away from direct sunlight. Hang silk on a padded hanger, or fold it loosely in a breathable garment bag.',
      'Avoid storing delicate fabrics in plastic for long periods.',
    ],
  },
  closing: 'Care for your plumpose, and it will stay with you beautifully.',
} as const

/**
 * /size-guide — hers, from her size chart image of 28 Sep 2026. Spellings
 * corrected ("trauser" → trouser, "convertion" → conversion). Measurements
 * are of the garment, in centimetres.
 */
export const SIZE_GUIDE = {
  label: 'Size guide',
  heading: 'Finding your size',
  intro:
    'plumpose pyjamas are designed for a relaxed fit, with slightly longer trousers for an elegant look. If you are between sizes, we recommend sizing up for extra comfort.',
  measurements: {
    heading: 'Size chart',
    note: 'Garment measurements, in centimetres.',
    columns: ['Chest', 'Shirt hem', 'Sleeve length', 'Trouser waist', 'Trouser hip', 'Inside leg'],
    rows: [
      { size: 'XS', values: ['50', '53', '58', '36.5', '51', '75.75'] },
      { size: 'S', values: ['52', '55', '58.5', '39', '53.5', '76.5'] },
      { size: 'M', values: ['54', '57', '59', '41.5', '56', '77.25'] },
      { size: 'L', values: ['56', '59', '59', '44', '58.5', '78'] },
      { size: 'XL', values: ['58', '64', '59', '46.5', '61', '78.75'] },
    ],
  },
  conversion: {
    heading: 'Size conversion',
    sizes: ['XS', 'S', 'M', 'L', 'XL'],
    rows: [
      { region: 'UK', values: ['8', '10', '12', '14', '16'] },
      { region: 'USA', values: ['4', '6', '8', '10', '12'] },
      { region: 'EU', values: ['36', '38', '40', '42', '44'] },
      { region: 'Australia', values: ['8', '10', '12', '14', '16'] },
      { region: 'Japan', values: ['7', '9', '11', '13', '15'] },
    ],
  },
} as const

/* ---------------------------------------------------------------------- Legal */

/**
 * Terms & Conditions and Privacy — hers, sent 28 Sep 2026. A section's body is
 * paragraphs; an array inside it is a bulleted list. Her "10. Contact" was
 * left blank; it takes the same contact as her privacy policy. Legal text is
 * published only as she approved it — change it only on her word.
 */
type LegalSection = { heading: string; body: ReadonlyArray<string | ReadonlyArray<string>> }

export const TERMS_PAGE: { heading: string; updated: string; intro: string[]; sections: LegalSection[] } = {
  heading: 'Terms & conditions',
  updated: 'September 2026',
  intro: [
    'Welcome to plumpose. By accessing or using our website, you agree to these Terms & Conditions.',
    'Please read them carefully before placing an order.',
  ],
  sections: [
    {
      heading: 'About plumpose',
      body: [
        'plumpose is a luxury loungewear and resortwear brand offering carefully designed garments and special pieces through our online store.',
      ],
    },
    {
      heading: 'Products',
      body: [
        'We make every effort to ensure that product descriptions, colours, measurements and images are accurate. However, colours may appear slightly different depending on your device or screen settings.',
        'Our garments are made from delicate materials and natural fibres. Minor variations in texture, colour or appearance may naturally occur and are not necessarily considered defects.',
      ],
    },
    {
      heading: 'Orders',
      body: [
        'When you place an order, you are making an offer to purchase the selected products.',
        'An order confirmation will be sent to the email address provided at checkout. We reserve the right to cancel or refuse an order where necessary, including in cases of incorrect pricing, stock discrepancies, suspected fraudulent activity or other exceptional circumstances.',
      ],
    },
    {
      heading: 'Prices & payment',
      body: [
        'All prices displayed on our website are in Qatari Riyals unless otherwise stated.',
        'Payment must be completed through the available payment methods at checkout.',
        'Any applicable customs duties, taxes or import charges associated with international orders are the responsibility of the customer unless otherwise stated.',
      ],
    },
    {
      heading: 'Shipping',
      body: [
        'Orders are generally prepared for dispatch within 2–4 business days. Estimated delivery times are:',
        [
          'Qatar: after dispatch, according to the selected delivery service',
          'GCC: generally within the applicable courier delivery timeframe',
          'International: generally within 14 business days',
        ],
        'Delivery times are estimates and may be affected by customs clearance, public holidays, courier delays or circumstances outside our control.',
      ],
    },
    {
      heading: 'Returns & exchanges',
      body: [
        'Please refer to our Returns & Exchange Policy for eligibility, timeframes and conditions.',
        'Due to the delicate nature of our garments, items must be returned in their original condition and must not have been worn, washed, altered, damaged or otherwise used.',
      ],
    },
    {
      heading: 'Intellectual property',
      body: [
        'All content on the plumpose website, including photography, illustrations, designs, graphics, logos, text, product names and other creative materials, belongs to or is licensed to plumpose unless otherwise stated.',
        'Content may not be copied, reproduced, modified, distributed or used commercially without prior written permission.',
      ],
    },
    {
      heading: 'Website use',
      body: [
        'You agree not to misuse our website, attempt to gain unauthorised access, interfere with its operation, or use the website for unlawful purposes.',
      ],
    },
    {
      heading: 'Changes',
      body: [
        'plumpose may update these Terms & Conditions from time to time. The latest version will always be published on our website.',
      ],
    },
    {
      heading: 'Contact',
      body: ['For questions regarding these Terms & Conditions, please contact us.'],
    },
  ],
}

/** Hers, in full — sent in two parts on 28 Sep 2026. */
export const PRIVACY_PAGE: { heading: string; updated: string; intro: string[]; sections: LegalSection[] } = {
  heading: 'Privacy policy',
  updated: 'September 2026',
  intro: [
    'At plumpose, we respect your privacy and are committed to protecting the information you share with us.',
    'This Privacy Policy explains how we collect, use and protect your personal information when you visit or make a purchase through our website.',
  ],
  sections: [
    {
      heading: 'Information we collect',
      body: [
        'When you place an order, create an account, subscribe to our newsletter, contact us, or interact with our website, we may collect information such as:',
        [
          'Your name',
          'Email address',
          'Telephone number',
          'Billing and delivery address',
          'Order and transaction details',
          'Account information',
          'Information you provide when contacting us',
          'Website usage and technical information, such as browser type, device and IP address',
        ],
        'Payment information may be processed securely through our third-party payment provider. plumpose does not store your complete payment card details.',
      ],
    },
    {
      heading: 'How we use your information',
      body: [
        'We use your information to:',
        [
          'Process and deliver your orders',
          'Communicate with you regarding your orders',
          'Provide customer support',
          'Process payments and refunds',
          'Improve our website, products and services',
          'Send newsletters or marketing communications where you have chosen to receive them',
          'Prevent fraud and protect the security of our website',
          'Comply with applicable legal and regulatory requirements',
        ],
      ],
    },
    {
      heading: 'Marketing',
      body: [
        'If you subscribe to our newsletter or otherwise provide consent to receive marketing communications, we may contact you about new collections, special projects, events and plumpose updates.',
        'You may unsubscribe from marketing communications at any time using the unsubscribe option included in our emails or by contacting us.',
      ],
    },
    {
      heading: 'Cookies',
      body: [
        'Our website may use cookies and similar technologies to provide essential website functionality, remember preferences, understand website usage and improve your experience.',
        'Third-party services such as analytics, payment or social-media tools may also use cookies or similar technologies in accordance with their own privacy policies.',
      ],
    },
    {
      heading: 'Sharing your information',
      body: [
        'We may share necessary information with trusted service providers who assist us with:',
        [
          'Payment processing',
          'Order fulfilment',
          'Shipping and delivery',
          'Website hosting and technical services',
          'Analytics and marketing',
        ],
        'We do not sell your personal information.',
      ],
    },
    {
      heading: 'Data security',
      body: [
        'We take reasonable measures to protect your personal information against unauthorised access, alteration, disclosure or destruction. However, no online transmission or storage system can be guaranteed to be completely secure.',
      ],
    },
    {
      heading: 'Your information',
      body: [
        'You may contact us to request access to, correction of, or information regarding the personal data we hold about you, subject to applicable law.',
      ],
    },
    {
      heading: 'Contact',
      body: ['For privacy-related enquiries, please contact us.'],
    },
  ],
}

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
