/**
 * What a video needs in place before it starts, made off camera through the
 * admin's own API as the signed-in recorder — for example video 02 (sizes)
 * starts from the piece video 01 adds on camera.
 */
import type { APIRequestContext } from '@playwright/test'

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

import { BASE, PHOTOS } from './stage'

/** The database the plumpose-demo launch entry runs on (see reset-demo.sh). */
const DEMO_DATABASE_URL = 'postgres://plumpose:plumpose@localhost:5434/plumpose_demo'

const ok = async (res: Awaited<ReturnType<APIRequestContext['get']>>, what: string) => {
  if (!res.ok()) throw new Error(`${what}: ${res.status()} ${await res.text()}`)
  return (await res.json()) as { doc: { id: number } }
}

const paragraph = (text: string) => ({
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

export const uploadPhoto = async (api: APIRequestContext, file: string, alt: string) => {
  const res = await api.post(`${BASE}/api/media`, {
    multipart: {
      _payload: JSON.stringify({ alt }),
      file: { buffer: fs.readFileSync(path.join(PHOTOS, file)), mimeType: 'image/jpeg', name: file },
    },
  })
  return (await ok(res, `upload ${file}`)).doc.id
}

/** Video 02's sizes on a piece: S, M and L with stock. Returns their ids by label. */
export const addSizes = async (api: APIRequestContext, productId: number) => {
  const types = await (await api.get(`${BASE}/api/variantTypes?where[name][equals]=Size`)).json()
  const res = await api.patch(`${BASE}/api/products/${productId}`, {
    data: { enableVariants: true, variantTypes: [types.docs[0].id] },
  })
  await ok(res, 'turn sizes on')
  const options = (await (await api.get(`${BASE}/api/variantOptions?limit=20`)).json()).docs as {
    id: number
    label: string
  }[]
  const ids: Record<string, number> = {}
  for (const [label, inventory] of [['S', 3], ['M', 5], ['L', 2]] as const) {
    const option = options.find((o) => o.label === label)!
    const made = await api.post(`${BASE}/api/variants`, {
      data: { inventory, options: [option.id], product: productId },
    })
    ids[label] = (await ok(made, `size ${label}`)).doc.id
  }
  return ids
}

/**
 * A paid order waiting to be made, as checkout leaves one (BUILD-LOG §32):
 * size M with hand embroidery on the pocket, delivery in Doha, a gift note.
 * Money in minor units, the breakdown adding up to the amount. The customer is
 * made up. Returns the order's id and its private link token.
 */
export const addPaidOrder = async (api: APIRequestContext) => {
  const productId = await addPiece(api)
  const sizes = await addSizes(api, productId)
  // Orders cannot be created over REST (only a paid checkout makes one), so
  // this one goes through the local API, against the demo database only.
  const run = spawnSync('npx', ['tsx', 'scripts/record/add-demo-order.ts', String(productId), String(sizes.M)], {
    encoding: 'utf8',
    env: { ...process.env, DATABASE_URL: DEMO_DATABASE_URL, MEDIA_STORAGE: 'disk', RESEND_API_KEY: '' },
    shell: true,
  })
  if (run.status !== 0) throw new Error(`create the order: ${run.stderr || run.stdout}`)
  return JSON.parse(run.stdout.trim().split('\n').at(-1)!) as { id: number; token: string }
}

/** The piece from video 01, published, with a price and photos and no sizes yet. */
export const addPiece = async (api: APIRequestContext) => {
  const photos = [
    await uploadPhoto(api, '04-standing-window-full.jpg', 'Al Shaheen Nights silk pyjama set, full length by a window'),
    await uploadPhoto(api, '06-print-macro-whaleshark.jpg', 'The whale shark print, close up'),
    await uploadPhoto(api, '02-seated-armchair.jpg', 'Seated in a blue armchair wearing the set'),
  ]
  const categories = await (await api.get(`${BASE}/api/categories?limit=1&where[slug][equals]=resort-2026`)).json()
  const res = await api.post(`${BASE}/api/products`, {
    data: {
      _status: 'published',
      categories: categories.docs?.[0]?.id ? [categories.docs[0].id] : [],
      colour: 'Midnight Navy',
      composition: '97% silk, 3% spandex',
      description: paragraph(
        'Inspired by the tranquil waters of Qatar and the seasonal gathering of whale sharks, rendered on lustrous silk with an exclusive hand-illustrated print.',
      ),
      fabric: 'in 22-momme silk',
      gallery: photos.map((image) => ({ image })),
      priceInQAR: 139900,
      priceInQAREnabled: true,
      title: 'Al Shaheen Nights — Silk Pyjama Set',
    },
  })
  return (await ok(res, 'create the piece')).doc.id
}
