import type { Payload } from 'payload'

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

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
        children: [{ type: 'text', detail: 0, format: 0, mode: 'normal', style: '', text, version: 1 }],
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
     this is skipped entirely when NODE_ENV is production, and the credentials
     are deliberately throwaway. The real account is created by the client. */
  if (process.env.NODE_ENV !== 'production') {
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
    ['brand-02-print-macro.jpg', 'The hand-drawn whale-shark print on navy silk, with cream piping'],
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

  const gallery = (
    brandImages.length ? brandImages.map((m) => m.id as number) : legacyGallery
  ).map((id) => ({ image: id }))

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

  // One variant per size, each with its own stock. Hand-finished to order,
  // so the opening stock figures are deliberately small.
  log('variants…')
  const stockBySize: Record<string, number> = { S: 4, M: 6, L: 4 }
  for (const size of ['S', 'M', 'L']) {
    await upsert(
      payload,
      'variants',
      {
        and: [
          { product: { equals: product.id } },
          { options: { equals: sizeOptions[size].id } },
        ],
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
  for (const [i, [key, name]] of placements.entries()) {
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
  for (const [i, [key, name, note]] of styles.entries()) {
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
  for (const [i, [key, name, svgPath]] of symbols.entries()) {
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
  for (const [i, [key, name, hex]] of threads.entries()) {
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
  for (const [i, [key, name, feeQar]] of cities.entries()) {
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
  for (const [i, [key, name, feeQar]] of zones.entries()) {
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
  for (const [i, [label, rewardType, rewardValue, weight, colour]] of segments.entries()) {
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
  ]
  for (const [i, [question, category, answer]] of faqs.entries()) {
    await upsert(
      payload,
      'faqs',
      { question: { equals: question } },
      { question, category, answer: para(answer), published: true },
      c,
    )
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
