/**
 * A demo catalogue, to see the storefront with more than one piece in it.
 *
 *   pnpm demo:seed     — adds ~20 demo pieces in four collections, with photos from Pexels
 *   pnpm demo:remove   — deletes every one of them, and their photos
 *
 * **Development only. Never run against the live shop.** The client's own
 * product is never touched. Everything this adds is marked so it can be found
 * again: products and collections have a web address starting `demo-`, photos
 * are `demo-pexels-<id>.jpg` with a caption naming the photographer.
 *
 * Photos come from the Pexels API (PEXELS_API_KEY in .env), are cached in
 * seed-assets/demo/ (gitignored — the repo is public), and are free to use under
 * the Pexels licence. They are stand-ins: a customer must receive what a photo
 * shows, so none of them may ever go live as a product photograph.
 *
 * The stock figures are chosen to show every state: plenty, low, one size sold
 * out, all sold out, made to order, and pieces with no sizes at all.
 */
import fs from 'fs'
import path from 'path'
import { getPayload, type Payload } from 'payload'
import { fileURLToPath } from 'url'

const dirname = path.dirname(fileURLToPath(import.meta.url))
process.loadEnvFile(path.resolve(dirname, '../.env'))

const CACHE = path.resolve(dirname, '../seed-assets/demo')
const PREFIX = 'demo-'

type Size = 'L' | 'M' | 'S'
type DemoPiece = {
  collection: keyof typeof COLLECTIONS
  colour: string
  description: string
  /** Pexels photo ids, first one is the card photo. */
  photos: number[]
  priceQar: number
  slug: string
  /** Per size — or one number for a piece with no sizes. */
  stock: number | Record<Size, number>
  madeToOrder?: boolean
  personalisation?: boolean
  title: string
}

const COLLECTIONS = {
  accessories: 'Sleep Accessories',
  robes: 'Robes',
  sets: 'Pyjama Sets',
  slips: 'Slips',
} as const

const PIECES: DemoPiece[] = [
  // ------------------------------------------------------------ pyjama sets
  {
    collection: 'sets', colour: 'Noir', priceQar: 1150, slug: 'noir-piped-set', title: 'Noir — Piped Silk Pyjama Set',
    description: 'Deep black silk with fine white piping at the collar, cuffs and pocket. A long shirt and full-length trousers, cut to move with you.',
    photos: [6976706, 6976713, 6976714, 6976739], stock: { L: 6, M: 10, S: 8 }, madeToOrder: false, personalisation: true,
  },
  {
    collection: 'sets', colour: 'Blush', priceQar: 1250, slug: 'blush-lounge-set', title: 'Blush — Silk Lounge Set',
    description: 'A soft blush set with a relaxed shirt and wide trousers, for slow mornings and late evenings alike.',
    photos: [7162014, 7162023, 7162013], stock: { L: 0, M: 2, S: 1 }, madeToOrder: false, personalisation: true,
  },
  {
    collection: 'sets', colour: 'Ivory', priceQar: 980, slug: 'ivory-shirt-shorts', title: 'Ivory — Silk Shirt & Shorts',
    description: 'An oversized ivory shirt with a tie-waist short. Light as air for the summer months.',
    photos: [20356192, 20356180, 20356176, 20356189], stock: { L: 0, M: 0, S: 0 }, madeToOrder: false, personalisation: true,
  },
  {
    collection: 'sets', colour: 'Terracotta', priceQar: 1299, slug: 'terracotta-set', title: 'Terracotta — Silk Pyjama Set',
    description: 'A warm, burnt-orange silk that catches the evening light. Notched collar, long trousers.',
    photos: [33672397], stock: { L: 5, M: 5, S: 5 }, personalisation: true,
  },
  {
    collection: 'sets', colour: 'Emerald', priceQar: 1199, slug: 'emerald-set', title: 'Emerald — Silk Pyjama Set',
    description: 'Jewel-green silk in the signature silhouette, with covered buttons and a relaxed leg.',
    photos: [9499298], stock: { L: 3, M: 4, S: 2 }, madeToOrder: false, personalisation: true,
  },
  {
    collection: 'sets', colour: 'Dove Grey', priceQar: 850, slug: 'dove-grey-cami-set', title: 'Dove Grey — Cami & Trouser Set',
    description: 'A bias-cut camisole with fine straps and a matching wide trouser in dove-grey silk.',
    photos: [6976322, 6976440], stock: { L: 6, M: 6, S: 6 },
  },
  {
    collection: 'sets', colour: 'Midnight', priceQar: 1350, slug: 'midnight-mens-set', title: 'Midnight — Men’s Piped Pyjama Set',
    description: 'For him: a classic long-sleeved shirt and trouser in midnight silk, finished with white piping.',
    photos: [20364758, 20364755], stock: { L: 3, M: 3, S: 3 }, personalisation: true,
  },
  {
    collection: 'sets', colour: 'Sage', priceQar: 1199, slug: 'sage-resort-set', title: 'Sage — Short-Sleeve Resort Set',
    description: 'Short sleeves and a camp collar in sage-green silk. Made to order for each customer.',
    photos: [32343659, 32343663], stock: { L: 0, M: 0, S: 0 }, personalisation: true,
  },
  {
    collection: 'sets', colour: 'Scarlet', priceQar: 890, slug: 'scarlet-sleep-shirt', title: 'Scarlet — Silk Sleep Shirt',
    description: 'A long, loose sleep shirt in scarlet silk with a curved hem. Ready in M; S and L are made to order.',
    photos: [20356220, 20356223, 20356199, 20356183], stock: { L: 0, M: 3, S: 0 },
  },

  // ------------------------------------------------------------------ robes
  {
    collection: 'robes', colour: 'Onyx', priceQar: 1050, slug: 'onyx-wrap-robe', title: 'Onyx — Silk Wrap Robe',
    description: 'A long black wrap robe with wide sleeves and a self-tie belt. The easiest thing to reach for.',
    photos: [8244572, 8244563, 8244565, 8244559], stock: { L: 4, M: 4, S: 4 }, madeToOrder: false, personalisation: true,
  },
  {
    collection: 'robes', colour: 'Pearl', priceQar: 1150, slug: 'pearl-bridal-robe', title: 'Pearl — Bridal Silk Robe',
    description: 'A pearl-white robe for the morning of the wedding. Add her initials in gold thread.',
    photos: [9197309, 9197313], stock: { L: 1, M: 1, S: 2 }, madeToOrder: false, personalisation: true,
  },
  {
    collection: 'robes', colour: 'Rose', priceQar: 1450, slug: 'rose-lace-robe-set', title: 'Rose — Lace-Trimmed Robe Set',
    description: 'A pale rose robe and camisole set edged in black lace at the neckline, sleeves and hem.',
    photos: [20337341, 20337344, 20337355, 20337354], stock: { L: 2, M: 0, S: 3 }, madeToOrder: false,
  },

  // ------------------------------------------------------------------ slips
  {
    collection: 'slips', colour: 'Champagne', priceQar: 780, slug: 'champagne-bias-slip', title: 'Champagne — Bias-Cut Slip',
    description: 'A midi slip cut on the bias so it falls close without clinging. Cowl neck, fine straps.',
    photos: [12466608, 12466616, 12466603, 12466620], stock: { L: 5, M: 5, S: 5 },
  },
  {
    collection: 'slips', colour: 'Ivory', priceQar: 720, slug: 'ivory-slip', title: 'Ivory — Silk Slip Dress',
    description: 'A short ivory slip with a V-neck and adjustable straps.',
    photos: [20364782, 20364786], stock: { L: 4, M: 4, S: 4 },
  },
  {
    collection: 'slips', colour: 'Lilac', priceQar: 690, slug: 'lilac-slip', title: 'Lilac — Silk Slip Dress',
    description: 'The short slip in soft lilac. One of each size left.',
    photos: [20364793], stock: { L: 1, M: 1, S: 1 }, madeToOrder: false,
  },
  {
    collection: 'slips', colour: 'Noir', priceQar: 750, slug: 'noir-slip', title: 'Noir — Silk Slip Dress',
    description: 'A knee-length black slip with a straight neckline. Wear it to bed, or out.',
    photos: [3746299, 3746308, 3746297], stock: { L: 6, M: 6, S: 6 },
  },
  {
    collection: 'slips', colour: 'Midnight Navy', priceQar: 760, slug: 'navy-cowl-slip', title: 'Midnight Navy — Cowl Slip',
    description: 'A long cowl-neck slip in midnight navy. Size S is sold out.',
    photos: [32192276], stock: { L: 2, M: 2, S: 0 }, madeToOrder: false,
  },

  // ------------------------------------------------------------ accessories
  {
    collection: 'accessories', colour: 'Cornflower', priceQar: 180, slug: 'cornflower-eye-mask', title: 'Cornflower — Silk Eye Mask',
    description: 'A padded silk eye mask with a soft elastic band. Kind to skin and lashes.',
    photos: [6541175, 6541213, 6541087, 6541108], stock: 20, personalisation: true,
  },
  {
    collection: 'accessories', colour: 'Pearl', priceQar: 160, slug: 'pearl-eye-mask', title: 'Pearl — Silk Eye Mask',
    description: 'The silk eye mask in pearl. Sold out for now.',
    photos: [9832085, 9832083, 9832086], stock: 0, madeToOrder: false,
  },
  {
    collection: 'accessories', colour: 'Champagne', priceQar: 320, slug: 'silk-pillowcase', title: 'Champagne — Silk Pillowcase',
    description: 'A 22-momme silk pillowcase with an envelope closure. Less friction for hair and skin overnight.',
    photos: [16065663, 14380623, 14380626], stock: 12, madeToOrder: false,
  },
]

// ------------------------------------------------------------------ helpers

const para = (text: string) => ({
  root: {
    children: [
      {
        children: [{ detail: 0, format: 0, mode: 'normal', style: '', text, type: 'text', version: 1 }],
        direction: 'ltr' as const,
        format: '' as const,
        indent: 0,
        textFormat: 0,
        type: 'paragraph',
        version: 1,
      },
    ],
    direction: 'ltr' as const,
    format: '' as const,
    indent: 0,
    type: 'root',
    version: 1,
  },
})

type PexelsPhoto = { alt: string; id: number; photographer: string; src: { original: string } }

/** The photo, from the local cache or downloaded once from Pexels. */
async function pexelsPhoto(id: number): Promise<{ file: string; meta: PexelsPhoto }> {
  const file = path.join(CACHE, `demo-pexels-${id}.jpg`)
  const metaFile = `${file}.json`
  if (fs.existsSync(file) && fs.existsSync(metaFile)) {
    return { file, meta: JSON.parse(fs.readFileSync(metaFile, 'utf8')) as PexelsPhoto }
  }

  const key = process.env.PEXELS_API_KEY
  if (!key) throw new Error('PEXELS_API_KEY is not set in .env')

  const res = await fetch(`https://api.pexels.com/v1/photos/${id}`, { headers: { Authorization: key } })
  if (!res.ok) throw new Error(`Pexels photo ${id}: ${res.status}`)
  const meta = (await res.json()) as PexelsPhoto

  // Large enough for the product page's zoom, small enough to upload quickly.
  const image = await fetch(`${meta.src.original}?auto=compress&cs=tinysrgb&w=1800`)
  if (!image.ok) throw new Error(`Pexels download ${id}: ${image.status}`)
  fs.mkdirSync(CACHE, { recursive: true })
  fs.writeFileSync(file, Buffer.from(await image.arrayBuffer()))
  fs.writeFileSync(metaFile, JSON.stringify({ alt: meta.alt, id: meta.id, photographer: meta.photographer, src: meta.src }))
  return { file, meta }
}

async function demoMedia(payload: Payload, id: number, fallbackAlt: string): Promise<number> {
  const filename = `demo-pexels-${id}.jpg`
  const existing = await payload.find({ collection: 'media', depth: 0, limit: 1, where: { filename: { equals: filename } } })
  if (existing.docs[0]) return existing.docs[0].id as number

  const { file, meta } = await pexelsPhoto(id)
  const doc = await payload.create({
    collection: 'media',
    data: {
      alt: meta.alt?.trim() || fallbackAlt,
      caption: para(`Demo photo by ${meta.photographer} on Pexels — not for launch.`),
    } as any,
    filePath: file,
  })
  return doc.id as number
}

// --------------------------------------------------------------------- seed

async function seedDemo(payload: Payload) {
  if (process.env.NODE_ENV === 'production') throw new Error('The demo catalogue is for development only.')

  const sizeType = (await payload.find({ collection: 'variantTypes', limit: 1, where: { name: { equals: 'Size' } } })).docs[0]
  if (!sizeType) throw new Error('Run `pnpm seed` first — the Size option does not exist yet.')
  const sizeOptions = Object.fromEntries(
    (
      await payload.find({ collection: 'variantOptions', limit: 10, where: { variantType: { equals: sizeType.id } } })
    ).docs.map((o: any) => [o.label, o.id]),
  ) as Record<Size, number>

  const collectionIds: Record<string, number> = {}
  for (const [key, title] of Object.entries(COLLECTIONS)) {
    const slug = `${PREFIX}${key}`
    const found = (await payload.find({ collection: 'categories', limit: 1, where: { slug: { equals: slug } } })).docs[0]
    collectionIds[key] = (found ?? (await payload.create({ collection: 'categories', data: { generateSlug: false, slug, title } as any })))
      .id as number
  }

  let created = 0
  for (const piece of PIECES) {
    const slug = `${PREFIX}${piece.slug}`
    if ((await payload.find({ collection: 'products', limit: 1, where: { slug: { equals: slug } } })).docs[0]) {
      console.log(`  = ${piece.title}`)
      continue
    }

    const gallery = []
    for (const id of piece.photos) gallery.push({ image: await demoMedia(payload, id, piece.title) })

    const sized = typeof piece.stock !== 'number'
    const priceInQAR = piece.priceQar * 100
    const product = await payload.create({
      collection: 'products',
      data: {
        _status: 'published',
        categories: [collectionIds[piece.collection]],
        colour: piece.colour,
        composition: '100% mulberry silk',
        description: para(piece.description),
        enableVariants: sized,
        fabric: 'in 19-momme silk',
        gallery,
        generateSlug: false,
        ...(sized ? {} : { inventory: piece.stock as number }),
        madeToOrder: piece.madeToOrder ?? true,
        personalisationEnabled: piece.personalisation ?? false,
        priceInQAR,
        priceInQAREnabled: true,
        slug,
        title: piece.title,
        ...(sized ? { variantTypes: [sizeType.id] } : {}),
      } as any,
    })

    if (sized) {
      for (const size of ['S', 'M', 'L'] as Size[]) {
        await payload.create({
          collection: 'variants',
          data: {
            _status: 'published',
            inventory: (piece.stock as Record<Size, number>)[size],
            options: [sizeOptions[size]],
            priceInQAR,
            priceInQAREnabled: true,
            product: product.id,
          } as any,
        })
      }
    }
    created++
    console.log(`  + ${piece.title}`)
  }
  created += await seedTwoColourPiece(payload, sizeType.id, sizeOptions, collectionIds.sets)
  console.log(`\n${created} demo pieces added (${PIECES.length + 1} in the demo catalogue).`)
}

/**
 * One piece in two colours, to try size × colour (REQUIREMENTS S4, A4): Noir in
 * S, M and L; Blush in S and M — M sold out — and not made in L at all. Each
 * colour has its own photographs, tied to it with "Only show for".
 */
async function seedTwoColourPiece(payload: Payload, sizeTypeId: number, sizeOptions: Record<Size, number>, collectionId: number) {
  const slug = `${PREFIX}two-colour-set`
  if ((await payload.find({ collection: 'products', limit: 1, where: { slug: { equals: slug } } })).docs[0]) {
    console.log('  = Classic — Silk Pyjama Set (two colours)')
    return 0
  }
  const colourType = (await payload.find({ collection: 'variantTypes', limit: 1, where: { name: { equals: 'Colour' } } })).docs[0]
  if (!colourType) throw new Error('Run `pnpm seed` first — the Colour option type does not exist yet.')

  const colour: Record<string, number> = {}
  for (const label of ['Noir', 'Blush']) {
    const value = `${PREFIX}${label.toLowerCase()}`
    const found = (await payload.find({ collection: 'variantOptions', limit: 1, where: { value: { equals: value } } })).docs[0]
    colour[label] = (found ?? (await payload.create({ collection: 'variantOptions', data: { label, value, variantType: colourType.id } as any }))).id as number
  }

  const gallery = []
  for (const id of [6976706, 6976713]) gallery.push({ image: await demoMedia(payload, id, 'Classic set in Noir'), variantOption: colour.Noir })
  for (const id of [7162014, 7162023]) gallery.push({ image: await demoMedia(payload, id, 'Classic set in Blush'), variantOption: colour.Blush })

  const priceInQAR = 118000
  const product = await payload.create({
    collection: 'products',
    data: {
      _status: 'published',
      categories: [collectionId],
      colour: 'Noir or Blush',
      composition: '100% mulberry silk',
      description: para('The classic set in two colours — deep noir, or a soft blush. Choose your colour and size.'),
      enableVariants: true,
      fabric: 'in 19-momme silk',
      gallery,
      generateSlug: false,
      madeToOrder: false,
      personalisationEnabled: true,
      priceInQAR,
      priceInQAREnabled: true,
      slug,
      title: 'Classic — Silk Pyjama Set',
      variantTypes: [sizeTypeId, colourType.id],
    } as any,
  })
  const made: Array<[Size, string, number]> = [
    ['S', 'Noir', 3],
    ['M', 'Noir', 3],
    ['L', 'Noir', 3],
    ['S', 'Blush', 2],
    ['M', 'Blush', 0],
  ]
  for (const [size, name, inventory] of made) {
    await payload.create({
      collection: 'variants',
      data: { _status: 'published', inventory, options: [sizeOptions[size], colour[name]], priceInQAR, priceInQAREnabled: true, product: product.id } as any,
    })
  }
  console.log('  + Classic — Silk Pyjama Set (two colours)')
  return 1
}

// ------------------------------------------------------------------- remove

/** Ids of the records whose `field` starts with `prefix` — exactly, not "contains". */
async function idsStartingWith(payload: Payload, collection: 'categories' | 'media' | 'products', field: string, prefix: string) {
  const { docs } = await payload.find({ collection, depth: 0, limit: 1000, pagination: false, where: { [field]: { like: prefix } } })
  return docs.filter((d: any) => String(d[field] ?? '').startsWith(prefix)).map((d: any) => d.id as number)
}

async function removeDemo(payload: Payload) {
  const products = await idsStartingWith(payload, 'products', 'slug', PREFIX)
  const categories = await idsStartingWith(payload, 'categories', 'slug', PREFIX)
  const media = await idsStartingWith(payload, 'media', 'filename', 'demo-pexels-')

  if (products.length) {
    await payload.delete({ collection: 'variants', where: { product: { in: products } } })
    await payload.delete({ collection: 'products', where: { id: { in: products } } })
  }
  if (categories.length) await payload.delete({ collection: 'categories', where: { id: { in: categories } } })
  if (media.length) await payload.delete({ collection: 'media', where: { id: { in: media } } })
  // The demo's own colours (Noir, Blush) — never the real sizes.
  const { docs: colours } = await payload.find({ collection: 'variantOptions', depth: 0, limit: 100, pagination: false, where: { value: { like: PREFIX } } })
  const demoColours = colours.filter((o: any) => String(o.value).startsWith(PREFIX)).map((o: any) => o.id)
  if (demoColours.length) await payload.delete({ collection: 'variantOptions', where: { id: { in: demoColours } } })

  console.log(
    `Removed ${products.length} demo pieces, ${categories.length} collections and ${media.length} photos. ` +
      'The cached downloads in seed-assets/demo/ are kept for next time.',
  )
}

// ---------------------------------------------------------------------- run

const { default: config } = await import('../src/payload.config.js')
const payload = await getPayload({ config })
const mode = process.argv[2]

try {
  if (mode === 'seed') await seedDemo(payload)
  else if (mode === 'remove') await removeDemo(payload)
  else throw new Error('Usage: demo-catalogue.ts seed | remove')
  process.exit(0)
} catch (error) {
  console.error(error)
  process.exit(1)
}
