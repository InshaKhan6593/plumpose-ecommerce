import type { Payload } from 'payload'

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { isLocalDatabase } from '../utilities/database'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)
const ASSETS = path.resolve(dirname, '../../seed-assets')

/**
 * Seeds plumpose with the real data lifted from the existing site:
 *
 *   netlify/lib/skipcash.mjs          -> the product and its price
 *   netlify/lib/shipping.mjs          -> Qatar cities and international zones
 *   netlify/lib/personalisation.mjs   -> embroidery placements, symbols, threads
 *   index.html                        -> copy, FAQs and product photography
 *
 * Idempotent: every record is looked up before it is created, so the script
 * can be re-run without duplicating anything.
 */

type SeedResult = { created: number; skipped: number }

const log = (msg: string) => console.log(`  ${msg}`)

/** Rich text helper — Lexical expects this shape for a simple paragraph. */
const para = (text: string) => ({
  root: {
    type: 'root',
    children: [
      {
        type: 'paragraph',
        children: [
          { type: 'text', detail: 0, format: 0, mode: 'normal', style: '', text, version: 1 },
        ],
        direction: 'ltr' as const,
        format: '' as const,
        indent: 0,
        textFormat: 0,
        version: 1,
      },
    ],
    direction: 'ltr' as const,
    format: '' as const,
    indent: 0,
    version: 1,
  },
})

/** Rich text of several paragraphs. */
const paras = (...texts: string[]) => {
  const doc = para(texts[0] ?? '')
  doc.root.children = texts.map((text) => para(text).root.children[0])
  return doc
}

/** Finds an existing doc by a unique-ish field, or creates it. */
async function upsert<T extends Record<string, any>>(
  payload: Payload,
  collection: any,
  where: Record<string, any>,
  data: T,
  counter: SeedResult,
): Promise<any> {
  const existing = await payload.find({ collection, where, limit: 1, depth: 0 })
  if (existing.docs.length > 0) {
    counter.skipped++
    return existing.docs[0]
  }
  const doc = await payload.create({ collection, data: data as any })
  counter.created++
  return doc
}

/** Uploads a file from seed-assets, unless media with that alt already exists. */
async function upsertMedia(payload: Payload, file: string, alt: string): Promise<any | null> {
  const existing = await payload.find({
    collection: 'media',
    where: { alt: { equals: alt } },
    limit: 1,
    depth: 0,
  })
  if (existing.docs.length > 0) return existing.docs[0]

  const filePath = path.join(ASSETS, file)
  if (!fs.existsSync(filePath)) {
    log(`! missing asset ${file} — skipped`)
    return null
  }

  return payload.create({
    collection: 'media',
    data: { alt },
    filePath,
  })
}

export async function seed(payload: Payload): Promise<void> {
  const c: SeedResult = { created: 0, skipped: 0 }

  /* -------------------------------------------------------- dev admin user
     A local development login so the admin can be opened without clicking
     through "create first user" after every schema reset. Development only —
     skipped when NODE_ENV is production **and whenever the database is not
     on this machine**: `pnpm seed` from a laptop pointed at Neon is still
     "development", and this password is in the repository. The real account
     is made with scripts/create-admin.ts. */
  if (process.env.NODE_ENV !== 'production' && isLocalDatabase()) {
    const devUser = await payload.find({
      collection: 'users',
      depth: 0,
      limit: 1,
      where: { email: { equals: 'dev@plumpose.local' } },
    })
    if (devUser.docs.length === 0) {
      await payload.create({
        collection: 'users',
        data: {
          email: 'dev@plumpose.local',
          name: 'Development',
          password: 'devpassword',
          roles: ['admin'],
        } as any,
      })
      c.created++
      log('dev admin created — dev@plumpose.local (local fixture, never seeded in production)')
    }
  }

  // ---------------------------------------------------------------- media
  log('media…')
  const images: Record<string, any> = {}
  const shots: Array<[string, string]> = [
    ['plumpose-00-hero.jpg', 'Al Shaheen Nights silk pyjama set in Midnight Navy, worn seated'],
    ['plumpose-01.jpg', 'Al Shaheen Nights silk pyjama set — detail'],
    ['plumpose-02.jpg', 'Al Shaheen Nights silk pyjama set — full length'],
    ['plumpose-03.jpg', 'Al Shaheen Nights silk pyjama set — reverse'],
    ['plumpose-04.jpg', 'Al Shaheen Nights whale shark print detail'],
    ['plumpose-05.jpg', 'Al Shaheen Nights contrast piping detail'],
    ['plumpose-06.png', 'plumpose atelier mark'],
  ]
  for (const [file, alt] of shots) {
    const m = await upsertMedia(payload, file, alt)
    if (m) images[file] = m
  }

  /**
   * The client's own photography, supplied 22 Sep 2026 at 1333×2000
   * (brand-assets/product/). The shots above were extracted from the base64
   * in her old index.html at 640–1100px and are kept only as a fallback. The
   * order is the product page's, from the approved mockup: full length first,
   * then the print, then the details.
   */
  const brandShots: Array<[string, string]> = [
    ['brand-01-window.jpg', 'Al Shaheen Nights silk pyjama set, full length by a window'],
    [
      'brand-02-print-macro.jpg',
      'The hand-drawn whale-shark print on navy silk, with cream piping',
    ],
    ['brand-03-piping.jpg', 'The shirt front: cream piping, mother-of-pearl buttons and pocket'],
    ['brand-04-corridor.jpg', 'Walking in the Al Shaheen Nights set along a hotel corridor'],
    ['brand-05-armchair.jpg', 'Seated in a blue armchair wearing the Al Shaheen Nights set'],
    ['brand-06-doorway.jpg', 'Portrait in a dark wood doorway wearing the Al Shaheen Nights set'],
    ['brand-07-qatar-book.jpg', 'Holding a book on Qatar, showing the piped cuff'],
  ]
  const brandImages: any[] = []
  for (const [file, alt] of brandShots) {
    const m = await upsertMedia(payload, file, alt)
    if (m) brandImages.push(m)
  }

  // ----------------------------------------------------------- categories
  log('collections…')
  const resort = await upsert(
    payload,
    'categories',
    { title: { equals: 'Resort 2026' } },
    { title: 'Resort 2026' },
    c,
  )

  // -------------------------------------------------------- variant types
  log('variant types…')
  const sizeType = await upsert(
    payload,
    'variantTypes',
    { name: { equals: 'Size' } },
    { name: 'Size', label: 'Size' },
    c,
  )

  /*
   * Colour and Pattern, ready for her to add options to (REQUIREMENTS S4, A4):
   * "Sizes, colours & patterns" in the admin, then tick them under "Options
   * offered" on a product. No options are seeded — every piece today is sized only.
   */
  for (const label of ['Colour', 'Pattern']) {
    await upsert(payload, 'variantTypes', { name: { equals: label } }, { label, name: label }, c)
  }

  const sizeOptions: Record<string, any> = {}
  // XS was withdrawn and XL is unavailable — see the comment in skipcash.mjs
  for (const label of ['S', 'M', 'L']) {
    sizeOptions[label] = await upsert(
      payload,
      'variantOptions',
      { and: [{ label: { equals: label } }, { variantType: { equals: sizeType.id } }] },
      { label, value: label.toLowerCase(), variantType: sizeType.id },
      c,
    )
  }

  // --------------------------------------------------------------- product
  log('product…')
  const legacyGallery = [
    'plumpose-00-hero.jpg',
    'plumpose-01.jpg',
    'plumpose-02.jpg',
    'plumpose-03.jpg',
    'plumpose-04.jpg',
    'plumpose-05.jpg',
  ]
    .filter((f) => images[f])
    .map((f) => images[f].id as number)

  const gallery = (brandImages.length ? brandImages.map((m) => m.id as number) : legacyGallery).map(
    (id) => ({ image: id }),
  )

  const existingProduct = await payload.find({
    collection: 'products',
    where: { slug: { equals: 'al-shaheen-nights' } },
    limit: 1,
    depth: 0,
  })

  // QAR 1,399.00 — the plugin stores money in minor units
  const PRICE_QAR = 139900

  let product = existingProduct.docs[0]
  if (!product) {
    product = await payload.create({
      collection: 'products',
      data: {
        title: 'Al Shaheen Nights — Silk Pyjama Set',
        slug: 'al-shaheen-nights',
        _status: 'published',
        categories: [resort.id],
        description: para(
          'Inspired by the tranquil waters of Qatar and the seasonal gathering of whale sharks, ' +
            'Al Shaheen Nights is rendered on lustrous silk with an exclusive hand-illustrated print. ' +
            'Cut in the signature plumpose silhouette, the set is tailored with contrast piping, a ' +
            'classic notched collar and elegantly long trousers designed for a graceful drape.',
        ),
        gallery,
        enableVariants: true,
        variantTypes: [sizeType.id],
        priceInQAREnabled: true,
        priceInQAR: PRICE_QAR,
      } as any,
    })
    c.created++
  } else {
    /**
     * Upgrade an existing database to the full-resolution photographs — but
     * only while the gallery is still exactly the seeded legacy set. A gallery
     * the client has edited is hers, and a re-seed must not overwrite it.
     */
    const current = (product.gallery ?? []).map((row: { image: any }) =>
      typeof row.image === 'object' ? row.image?.id : row.image,
    )
    const untouched =
      current.length === legacyGallery.length &&
      current.every((id: number, i: number) => id === legacyGallery[i])

    if (untouched && brandImages.length) {
      product = await payload.update({
        collection: 'products',
        data: { gallery } as any,
        id: product.id,
      })
      log('product gallery upgraded to the full-resolution photographs')
      c.created++
    } else {
      c.skipped++
    }
  }

  /**
   * The product's detail rows, from the old site's "Product details",
   * "Material & care" and "Gift packaging" panels — her words, verbatim.
   * Filled field by field, and only where the field is still empty, so
   * anything she has since edited in the admin is left alone.
   *
   * Delivery & returns is left empty on purpose: the product page then builds
   * it from the live rate tables, so it can never quote a stale fee.
   *
   * ⚠️ The old site says "Pure 22-momme silk" and "97% silk, 3% spandex" —
   * both are carried over; the client is asked to confirm (BUILD-LOG §17).
   */
  const productDetails: Record<string, unknown> = {
    colour: 'Midnight Navy',
    composition: '97% silk, 3% spandex',
    fabric: 'in 22-momme silk',
    fabricWeight: '22 momme',
    fitNote: 'Model is 175cm and wears a size M',
    giftPackaging: para(
      'Every plumpose order is presented in our signature packaging and finished with a complimentary thank-you card — ideal for gifting, or for keeping as a personal indulgence.',
    ),
    materialCare: para(
      "To preserve the beauty of this piece, we recommend dry cleaning or gentle hand washing at 30°C with a specialist silk detergent. Iron on a cool setting to restore the silk's natural lustre. Please do not leave the garment to soak or tumble dry. Store folded away from direct sunlight to protect the fabric and print.",
    ),
    trims: 'Contrast piping',
  }
  const missing = Object.fromEntries(
    Object.entries(productDetails).filter(([key]) => {
      const current = (product as unknown as Record<string, unknown>)[key]
      return current === null || current === undefined || current === ''
    }),
  )
  if (Object.keys(missing).length) {
    product = await payload.update({ collection: 'products', data: missing as any, id: product.id })
    log(`product details filled: ${Object.keys(missing).join(', ')}`)
    c.created++
  }

  // One variant per size, each with its own stock. Hand-finished to order,
  // so the opening stock figures are deliberately small.
  log('variants…')
  const stockBySize: Record<string, number> = { S: 4, M: 6, L: 4 }
  for (const size of ['S', 'M', 'L']) {
    await upsert(
      payload,
      'variants',
      {
        and: [{ product: { equals: product.id } }, { options: { equals: sizeOptions[size].id } }],
      },
      {
        product: product.id,
        options: [sizeOptions[size].id],
        inventory: stockBySize[size],
        priceInQAREnabled: true,
        priceInQAR: PRICE_QAR,
        _status: 'published',
      },
      c,
    )
  }

  // ------------------------------------------------- personalisation options
  log('personalisation…')
  const placements = [
    ['pocket', 'Pocket'],
    ['neck', 'Neck'],
    ['cuff', 'Cuff'],
    ['collar', 'Collar'],
  ]
  for (const [key, name] of placements) {
    await upsert(
      payload,
      'personalisationOptions',
      { key: { equals: key } },
      { key, name, type: 'placement', active: true },
      c,
    )
  }

  const styles: Array<[string, string, string]> = [
    ['text', 'Letters only', 'Your initials, or a short word.'],
    ['symbol', 'Symbol only', 'One hand-stitched motif.'],
    ['both', 'Letters + symbol', 'Lettering with a motif beside it.'],
  ]
  for (const [key, name, note] of styles) {
    await upsert(
      payload,
      'personalisationOptions',
      { key: { equals: key } },
      { key, name, note, type: 'style', active: true },
      c,
    )
  }

  const symbols: Array<[string, string, string]> = [
    [
      'star',
      'Four-pointed star',
      'M12 1.2c.65 6 4.6 9.95 11.2 11.3C16.6 13.85 12.65 17.8 12 23.8c-.65-6-4.6-9.95-11.2-11.3C7.4 11.15 11.35 7.2 12 1.2z',
    ],
    ['crescent', 'Crescent moon', 'M20.6 15.4A8.7 8.7 0 0 1 9.2 4 8.7 8.7 0 1 0 20.6 15.4z'],
    [
      'heart',
      'Heart',
      'M12 21.2C9.1 19 2.9 14.6 2.9 10.4A4.9 4.9 0 0 1 12 7.6a4.9 4.9 0 0 1 9.1 2.8c0 4.2-6.2 8.6-9.1 10.8z',
    ],
    [
      'sun',
      'Sun',
      'M12 7.6a4.4 4.4 0 1 0 0 8.8 4.4 4.4 0 0 0 0-8.8zM12 1.4v3.2M12 19.4v3.2M1.4 12h3.2M19.4 12h3.2M4.5 4.5l2.3 2.3M17.2 17.2l2.3 2.3M19.5 4.5l-2.3 2.3M6.8 17.2l-2.3 2.3',
    ],
  ]
  for (const [key, name, svgPath] of symbols) {
    await upsert(
      payload,
      'personalisationOptions',
      { key: { equals: key } },
      { key, name, svgPath, type: 'symbol', active: true },
      c,
    )
  }

  const threads: Array<[string, string, string]> = [
    ['cream', 'Cream', '#EFE4CE'],
    ['gold', 'Gold', '#BD9540'],
    ['silver', 'Silver', '#B4BAC1'],
    ['red', 'Red', '#9C1C25'],
    ['pink', 'Pink', '#D69FAB'],
  ]
  for (const [key, name, hex] of threads) {
    await upsert(
      payload,
      'personalisationOptions',
      { key: { equals: key } },
      { key, name, hex, type: 'thread', active: true },
      c,
    )
  }

  // ------------------------------------------------------------- shipping
  log('shipping…')
  const DOHA = 20
  const OUTSIDE = 50
  const cities: Array<[string, string, number]> = [
    ['doha', 'Doha', DOHA],
    ['al-rayyan', 'Al Rayyan', DOHA],
    ['al-wakrah', 'Al Wakrah', DOHA],
    ['umm-salal', 'Umm Salal', DOHA],
    ['al-daayen', 'Al Daayen', DOHA],
    ['al-khor', 'Al Khor & Al Dhakhira', OUTSIDE],
    ['al-shamal', 'Al Shamal', OUTSIDE],
    ['al-shahaniya', 'Al Shahaniya', OUTSIDE],
    ['dukhan', 'Dukhan', OUTSIDE],
    ['mesaieed', 'Mesaieed', OUTSIDE],
    ['ras-laffan', 'Ras Laffan', OUTSIDE],
  ]
  for (const [key, name, feeQar] of cities) {
    await upsert(
      payload,
      'shippingCities',
      { key: { equals: key } },
      { key, name, feeQar, active: true },
      c,
    )
  }

  const zones: Array<[string, string, number]> = [
    ['uae', 'United Arab Emirates', 150],
    ['saudi', 'Saudi Arabia', 160],
    ['kuwait', 'Kuwait', 130],
    ['bahrain', 'Bahrain', 120],
    ['oman', 'Oman', 130],
    ['uk', 'United Kingdom', 200],
    ['europe', 'Europe', 200],
    ['americas', 'United States & Canada', 240],
    ['oceania', 'Australia & New Zealand', 270],
    ['world', 'Rest of world', 300],
  ]
  for (const [key, name, feeQar] of zones) {
    await upsert(
      payload,
      'shippingZones',
      { key: { equals: key } },
      { key, name, feeQar, active: true },
      c,
    )
  }

  // ------------------------------------------------ countries & currencies
  // Extracted from the legacy site with scripts/extract-legacy-tables.mjs
  log('countries & currencies…')
  const countries = JSON.parse(
    fs.readFileSync(path.join(dirname, 'data/countries.json'), 'utf8'),
  ) as Array<{
    blockedReason: null | string
    code: string
    currencyCode: string
    name: string
    zoneKey: string
  }>

  for (const row of countries) {
    await upsert(payload, 'countries', { code: { equals: row.code } }, row as any, c)
  }

  const currencies = JSON.parse(
    fs.readFileSync(path.join(dirname, 'data/currencies.json'), 'utf8'),
  ) as Array<{
    code: string
    decimals: number
    name: string
    priceOverride: null | number
    step: number
    symbol: string
  }>

  for (const row of currencies) {
    await upsert(payload, 'currencies', { code: { equals: row.code } }, row as any, c)
  }

  // ---------------------------------------------------------- reward wheel
  log('reward wheel…')
  const segments: Array<[string, string, number | undefined, number, string]> = [
    ['10% off', 'percent', 10, 40, '#f6f4f0'],
    ['QAR 100 off', 'fixed', 100, 15, '#eae5db'],
    ['Free delivery', 'freeShipping', undefined, 25, '#f6f4f0'],
    ['Roll again', 'rollAgain', undefined, 20, '#eae5db'],
  ]
  for (const [label, rewardType, rewardValue, weight, colour] of segments) {
    await upsert(
      payload,
      'spinSegments',
      { label: { equals: label } },
      { label, rewardType, rewardValue, weight, colour, expiryDays: 30, active: true },
      c,
    )
  }

  // ------------------------------------------------------------------ FAQs
  log('faqs…')
  const faqs: Array<[string, string, string]> = [
    [
      'How long does my order take?',
      'delivery',
      'Every piece is hand-finished to order. Personalised pieces take an additional 4–10 working days in our atelier.',
    ],
    [
      'Where do you deliver?',
      'delivery',
      'We deliver across Qatar and worldwide. Delivery within Qatar is priced by city; everywhere else is priced by zone at checkout.',
    ],
    [
      'Can I return a personalised piece?',
      'returns',
      'Personalised or monogrammed pieces are not eligible for return or exchange. All other items may be returned within 14 days of delivery, unworn and in their original packaging.',
    ],
    [
      'What currency am I charged in?',
      'orders',
      'Prices are shown in your own currency as a guide, but every card is charged in Qatari Riyal. The QAR total is always shown before you pay.',
    ],
    [
      'How should I care for my silk?',
      'care',
      'Dry clean, or hand wash gently at 30°C with a specialist silk detergent. Iron on a cool setting. Do not soak or tumble dry. Store folded, away from direct sunlight.',
    ],
    [
      'What does the embroidery cost?',
      'personalisation',
      'Hand embroidery is QAR 160 per placement, per garment. Up to two placements can be added to a single set.',
    ],
    /*
     * Added for the FAQ page (24 Sep 2026). Every answer restates something
     * the old site already said — the checkout, the returns policy, the
     * product details, the embroidery drawer — rather than inventing policy.
     * Fees are not repeated here: answers point to Shipping & Returns, which
     * reads the live tables, so an FAQ cannot quote a stale price.
     */
    [
      'Which payment methods do you accept?',
      'orders',
      'Visa, Mastercard and American Express. Your card details are entered on a secure banking page — plumpose never sees or stores them.',
    ],
    [
      'Can I send my order as a gift?',
      'orders',
      'Yes. Choose “This is a gift” at checkout and we will handwrite your message onto a plumpose card. The price is never shown inside a gift parcel.',
    ],
    [
      'How do I track my order?',
      'orders',
      'Your confirmation email carries a private link to your order, where you can see each step as it happens. You can also ask for that link again from Track order, with your email and order number.',
    ],
    [
      'How much is delivery?',
      'delivery',
      'Within Qatar we charge a flat rate by city; everywhere else, a flat rate by destination. Every rate is listed on our Shipping & Returns page, and your exact delivery charge is shown at checkout before you pay.',
    ],
    [
      'How do I return or exchange a piece?',
      'returns',
      'Write to info@plumpose.com or send us a message on Instagram within 14 days of delivery. Pieces must be unworn, unwashed and in their original packaging. Return shipping is paid by the customer unless the item is faulty or incorrect.',
    ],
    [
      'My piece arrived damaged or incorrect. What should I do?',
      'returns',
      'We are sorry. Please contact us within 48 hours of delivery, with a photograph if you can, and we will put it right.',
    ],
    [
      'Can I check my embroidery before it is stitched?',
      'personalisation',
      'Your lettering is stitched exactly as typed, so please check the spelling before adding the piece to your bag — the bag and your confirmation email both show it as it will be stitched. Personalised pieces cannot be returned.',
    ],
    [
      'Where can the embroidery go?',
      'personalisation',
      'On the pocket, the neck, the cuff or the collar — up to two placements on a set. Choose letters, a symbol, or both, and one of five thread colours.',
    ],
    [
      'What is the set made of?',
      'care',
      'Al Shaheen Nights is cut from 22-momme silk (97% silk, 3% spandex) in Midnight Navy, with contrast piping and French seams finished by hand.',
    ],
    [
      'How does it fit?',
      'care',
      'The set comes in S, M and L, cut in the signature plumpose silhouette with elegantly long trousers designed for a graceful drape. Our model is 175cm and wears a size M. If you are unsure, write to us and we will help you choose.',
    ],
  ]
  for (const [question, category, answer] of faqs) {
    await upsert(
      payload,
      'faqs',
      { question: { equals: question } },
      { question, category, answer: para(answer), published: true },
      c,
    )
  }

  // ------------------------------------------------------- contact form
  /**
   * The form the Contact page submits to (src/app/(app)/contact). Messages
   * land in the admin under Content → Enquiries. No notification email is
   * configured: the form plugin writes submitted values into the email's HTML
   * unescaped, so it waits for an escaping `beforeEmail` hook (BUILD-LOG §17).
   */
  log('contact form…')
  const formField = (
    blockType: string,
    name: string,
    label: string,
    required: boolean,
    width = 50,
  ) => ({
    blockType,
    label,
    name,
    required,
    width,
  })
  await upsert(
    payload,
    'forms',
    { title: { equals: 'Contact' } },
    {
      confirmationMessage: para(
        'Thank you. Your message is with us. We usually reply within a day.',
      ),
      confirmationType: 'message',
      fields: [
        formField('text', 'name', 'Name', true),
        formField('email', 'email', 'Email', true),
        formField('text', 'subject', 'About', false),
        formField('text', 'orderNumber', 'Order number', false),
        formField('textarea', 'message', 'Message', true, 100),
      ],
      submitButtonLabel: 'Send',
      title: 'Contact',
    },
    c,
  )

  // ------------------------------------------- Made for You — samples, dev only
  /**
   * SAMPLE projects so Made for You can be reviewed with its project grid and
   * detail pages filled. They are **not real commissions**: seeded outside
   * production, or on a live database only when asked with SEED_SAMPLES=yes
   * (for testing before launch — `pnpm demo:remove` deletes them again), and
   * listed in BUILD-LOG §17 for the client to replace with her own work.
   * Unlike the dev admin above, which never reaches a live database.
   */
  if (
    ((process.env.NODE_ENV !== 'production' && isLocalDatabase()) ||
      process.env.SEED_SAMPLES === 'yes') &&
    brandImages.length >= 7
  ) {
    log('made for you (SAMPLE projects — pnpm demo:remove deletes them)…')
    const [window, print, piping, corridor, armchair, doorway, qatarBook] = brandImages.map(
      (m) => m.id as number,
    )
    const samples: Array<{
      category: string
      coverImage: number
      description: string[]
      gallery: number[]
      slug: string
      summary: string
      title: string
    }> = [
      {
        category: 'bridal',
        coverImage: window,
        description: [
          'For the morning of a wedding in Doha: a set for the bride, and one for each of her sisters, every pocket embroidered in gold with a first initial.',
          'The bride’s set carried the wedding date at the cuff in cream thread, small enough to be found only by those who knew to look.',
        ],
        gallery: [armchair, piping, qatarBook],
        slug: 'sample-a-bridal-morning',
        summary:
          'Sets for a bride and her sisters, each pocket embroidered with an initial in gold.',
        title: 'A bridal morning',
      },
      {
        category: 'embroidery',
        coverImage: piping,
        description: [
          'Initials and a four-pointed star at the pocket, stitched by hand in gold thread on Midnight Navy silk.',
        ],
        gallery: [print, corridor, doorway],
        slug: 'sample-initials-in-gold',
        summary: 'Initials and a four-pointed star at the pocket, in gold thread.',
        title: 'Initials in gold',
      },
      {
        category: 'bespoke',
        coverImage: armchair,
        description: [
          'The Al Shaheen Nights set, with the trousers cut to the client’s height and the sleeves shortened a little, finished with cream piping.',
        ],
        gallery: [doorway, window],
        slug: 'sample-cut-to-measure',
        summary: 'The set cut to the client’s height, with cream piping.',
        title: 'Cut to measure',
      },
    ]
    for (const sample of samples) {
      await upsert(
        payload,
        'projects',
        { slug: { equals: sample.slug } },
        {
          ...sample,
          description: paras(...sample.description),
          gallery: sample.gallery.map((image) => ({ image })),
          published: true,
        },
        c,
      )
    }
  }

  // -------------------------------------------------------- site settings
  log('site settings…')
  await payload.updateGlobal({
    slug: 'siteSettings',
    data: {
      contactEmail: 'info@plumpose.com',
      instagramHandle: '@plumpose',
      instagramUrl: 'https://instagram.com/plumpose',
      announcementEnabled: true,
      announcementText: 'RESORT 2026 · NOW SHIPPING WORLDWIDE · EACH PIECE HAND-FINISHED TO ORDER',
      freeShippingEnabled: false,
      intlSurchargePct: 0,
      // From the constants at the top of the old personalisation.mjs
      personalisationFeeQar: 160,
      personalisationLeadTime: '4–10 working days',
      personalisationMaxChars: 6,
      personalisationMaxPlacements: 2,
      personalisationReturnable: false,
      spinWheelEnabled: true,
      spinWheelHeading: 'Before anyone else.',
      spinWheelBody:
        'A short note when a new print is drawn, when a size comes back, and when something is kept aside for the list. Nothing more than that.',
    } as any,
  })

  console.log(`\n  seed complete — ${c.created} created, ${c.skipped} already present\n`)
}
