/**
 * Does an edit in the admin reach the live storefront?
 *
 *   pnpm build && pnpm start          # a production server — see below
 *   npx tsx scripts/check-admin-reflects.ts [http://localhost:3000]
 *
 * For each thing the client can edit, this saves a change through the same
 * REST API the admin screens use (so the same hooks run), loads the public
 * page a visitor would see, checks the change is there, and puts the original
 * back. Every change is undone, even when a check fails.
 *
 * **Run it against a production build.** In `pnpm dev` every page is rendered
 * fresh on every visit, so everything passes there and proves nothing. In
 * production most pages are prerendered, and an edit only shows if a hook
 * tells Next to refresh them — which is exactly what this checks.
 *
 * Signs in as the local dev admin (`pnpm seed`). Development databases only.
 */
const BASE = process.argv[2] || 'http://localhost:3000'
const MARK = `Zq${Date.now().toString(36)}`

let auth = ''
const api = async (method: string, path: string, body?: unknown) => {
  const res = await fetch(`${BASE}/api${path}`, {
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `JWT ${auth}` } : {}) },
    method,
  })
  const json = (await res.json().catch(() => ({}))) as any
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${JSON.stringify(json).slice(0, 300)}`)
  return json
}
const one = async (collection: string, where: string) => (await api('GET', `/${collection}?limit=1&depth=0&${where}`)).docs[0]

/** The page as a visitor gets it, markup stripped to text (plus the raw HTML for attributes). */
const visit = async (path: string) => {
  const res = await fetch(`${BASE}${path}`, { headers: { 'Cache-Control': 'no-cache' } })
  const html = await res.text()
  const text = html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ')
  return { html, status: res.status, text }
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Loads the page up to four times. "fresh" on the first load is what a
 * visitor sees straight after she saves; a later one means the first visitor
 * after an edit still gets the old page (stale-while-revalidate).
 */
async function seen(path: string, test: (page: Awaited<ReturnType<typeof visit>>) => boolean) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    const page = await visit(path)
    if (test(page)) return attempt
    await sleep(1200)
  }
  return 0
}

type Result = { area: string; page: string; after: string; revert: string }
const results: Result[] = []
const word = (n: number) => (n === 1 ? 'yes, at once' : n > 1 ? `yes, on visit ${n}` : 'NO')

/** Change, check each page, undo, check each page again. */
async function check(
  area: string,
  pages: string[],
  change: () => Promise<void>,
  undo: () => Promise<void>,
  present: (p: Awaited<ReturnType<typeof visit>>) => boolean,
) {
  // Warm every page first, so a stale copy exists to be caught.
  for (const page of pages) await visit(page)
  try {
    await change()
    const after: number[] = []
    for (const page of pages) after.push(await seen(page, present))
    await undo()
    for (const [i, page] of pages.entries()) {
      const back = await seen(page, (p) => !present(p))
      results.push({ after: word(after[i]), area, page, revert: word(back) })
    }
  } catch (error) {
    results.push({ after: `ERROR ${(error as Error).message.slice(0, 120)}`, area, page: pages.join(' '), revert: '' })
    await undo().catch(() => undefined)
  }
}
const has = (s: string) => (p: { text: string }) => p.text.includes(s)
const hasHtml = (s: string) => (p: { html: string }) => p.html.includes(s)

async function run() {
  auth = (await api('POST', '/users/login', { email: 'dev@plumpose.local', password: 'devpassword' })).token

  // ------------------------------------------------------------ site settings
  const settings = await api('GET', '/globals/siteSettings?depth=0')
  const setSettings = (data: object) => api('POST', '/globals/siteSettings', data)
  await check('Settings → announcement bar', ['/', '/faq', '/shop', '/products/al-shaheen-nights'],
    () => setSettings({ announcementEnabled: true, announcementText: `Announcement ${MARK}` }).then(() => undefined),
    () => setSettings({ announcementEnabled: settings.announcementEnabled, announcementText: settings.announcementText }).then(() => undefined),
    has(MARK))
  await check('Settings → contact email', ['/', '/contact'],
    () => setSettings({ contactEmail: `${MARK.toLowerCase()}@example.com` }).then(() => undefined),
    () => setSettings({ contactEmail: settings.contactEmail }).then(() => undefined),
    has(MARK.toLowerCase()))
  await check('Settings → embroidery fee', ['/products/al-shaheen-nights', '/', '/our-story'],
    () => setSettings({ personalisationFeeQar: 173 }).then(() => undefined),
    () => setSettings({ personalisationFeeQar: settings.personalisationFeeQar }).then(() => undefined),
    has('173'))
  await check('Settings → free delivery threshold', ['/shipping-returns'],
    () => setSettings({ freeShippingEnabled: true, freeShippingThresholdQar: 4713 }).then(() => undefined),
    () => setSettings({ freeShippingEnabled: settings.freeShippingEnabled, freeShippingThresholdQar: settings.freeShippingThresholdQar }).then(() => undefined),
    has('4,713'))
  await check('Settings → embroidery lead time', ['/'],
    () => setSettings({ personalisationLeadTime: '17–19 working days' }).then(() => undefined),
    () => setSettings({ personalisationLeadTime: settings.personalisationLeadTime }).then(() => undefined),
    has('17–19'))
  await check('Settings → wheel heading', ['/api/spin'],
    () => setSettings({ spinWheelHeading: `Heading ${MARK}` }).then(() => undefined),
    () => setSettings({ spinWheelHeading: settings.spinWheelHeading }).then(() => undefined),
    hasHtml(MARK))

  // ----------------------------------------------------------------- products
  const hers = await one('products', 'where[slug][equals]=al-shaheen-nights')
  await check('Product → name (her piece)', ['/', '/shop', '/products/al-shaheen-nights'],
    () => api('PATCH', `/products/${hers.id}`, { title: `Al Shaheen ${MARK} — Silk Pyjama Set` }).then(() => undefined),
    () => api('PATCH', `/products/${hers.id}`, { title: hers.title }).then(() => undefined),
    has(MARK))

  const variants = (await api('GET', `/variants?limit=10&depth=0&where[product][equals]=${hers.id}`)).docs
  await check('Sizes → price (her piece)', ['/', '/shop', '/products/al-shaheen-nights'],
    async () => { for (const v of variants) await api('PATCH', `/variants/${v.id}`, { priceInQAR: 145600 }) },
    async () => { for (const v of variants) await api('PATCH', `/variants/${v.id}`, { priceInQAR: v.priceInQAR }) },
    has('1,456'))

  const demo = await one('products', 'where[slug][equals]=demo-noir-piped-set')
  if (demo) {
    const demoVariants = (await api('GET', `/variants?limit=10&depth=0&where[product][equals]=${demo.id}`)).docs
    // Its own page only: the shop already says "Sold out" for other pieces.
    await check('Sizes → stock to 0 (demo piece)', [`/products/${demo.slug}`],
      async () => { for (const v of demoVariants) await api('PATCH', `/variants/${v.id}`, { inventory: 0 }) },
      async () => { for (const v of demoVariants) await api('PATCH', `/variants/${v.id}`, { inventory: v.inventory }) },
      has('Sold out'))
    await check('Product → unpublish (demo piece)', ['/shop'],
      () => api('PATCH', `/products/${demo.id}`, { _status: 'draft' }).then(() => undefined),
      () => api('PATCH', `/products/${demo.id}`, { _status: 'published' }).then(() => undefined),
      (p) => !p.html.includes(`/products/${demo.slug}`))
  }

  // ------------------------------------------------------------- collections
  const cat = await one('categories', 'where[slug][equals]=resort-2026')
  await check('Collections → rename', ['/', '/shop', '/products/al-shaheen-nights'],
    () => api('PATCH', `/categories/${cat.id}`, { title: `Resort ${MARK}` }).then(() => undefined),
    () => api('PATCH', `/categories/${cat.id}`, { title: cat.title }).then(() => undefined),
    has(MARK))

  // ------------------------------------------------------------------ content
  const faq = await one('faqs', 'where[published][equals]=true')
  await check('FAQs → question', ['/faq'],
    () => api('PATCH', `/faqs/${faq.id}`, { question: `${faq.question} ${MARK}` }).then(() => undefined),
    () => api('PATCH', `/faqs/${faq.id}`, { question: faq.question }).then(() => undefined),
    has(MARK))

  let pressId: number | undefined
  await check('Press → add a feature', ['/press'],
    async () => { pressId = (await api('POST', '/press', { date: '2026-09-01', headline: `Headline ${MARK}`, publication: 'Test Weekly', published: true })).doc.id },
    async () => { if (pressId) await api('DELETE', `/press/${pressId}`) },
    has(MARK))

  const aPhoto = await one('media', 'where[filename][equals]=brand-05-armchair.jpg')
  let spottedId: number | undefined
  await check('Spotted → approve a post', ['/spotted', '/'],
    async () => { spottedId = (await api('POST', '/spotted', { caption: `Caption ${MARK}`, image: aPhoto.id, instagramHandle: `${MARK.toLowerCase()}`, status: 'approved' })).doc.id },
    async () => { if (spottedId) await api('DELETE', `/spotted/${spottedId}`) },
    // /spotted prints the handle; the homepage strip is photographs only, so look for the strip.
    (p) => p.text.includes(MARK.toLowerCase()) || /<h2[^>]*>Spotted<\/h2>/.test(p.html))

  let reviewId: number | undefined
  await check('Reviews → approve a review', ['/'],
    async () => { reviewId = (await api('POST', '/reviews', { body: `Lovely ${MARK}`, email: 'e2eonly-review@plumpose.local', name: 'Test Reviewer', product: hers.id, rating: 5, status: 'approved' })).doc.id },
    async () => { if (reviewId) await api('DELETE', `/reviews/${reviewId}`) },
    has(MARK))

  const project = await one('projects', 'where[published][equals]=true')
  if (project) {
    await check('Made for You → project title', ['/made-for-you', `/made-for-you/${project.slug}`],
      () => api('PATCH', `/projects/${project.id}`, { title: `${project.title} ${MARK}` }).then(() => undefined),
      () => api('PATCH', `/projects/${project.id}`, { title: project.title }).then(() => undefined),
      has(MARK))
  }

  const homePhotoName = (await visit('/')).html.match(/api\/media\/file\/([\w.-]+\.(?:jpg|png|webp))/)?.[1]
  const homePhoto = homePhotoName ? await one('media', `where[filename][equals]=${homePhotoName}`) : null
  if (homePhoto) {
    await check('Media → photo description (alt)', ['/'],
      () => api('PATCH', `/media/${homePhoto.id}`, { alt: `${homePhoto.alt} ${MARK}` }).then(() => undefined),
      () => api('PATCH', `/media/${homePhoto.id}`, { alt: homePhoto.alt }).then(() => undefined),
      hasHtml(MARK))
  }

  let pageId: number | undefined
  await check('Pages → publish a new page', [`/${MARK.toLowerCase()}`],
    async () => {
      pageId = (await api('POST', '/pages', {
        _status: 'published',
        layout: [{ blockType: 'content', columns: [{ richText: { root: { children: [{ children: [{ text: `Body ${MARK}`, type: 'text', version: 1 }], type: 'paragraph', version: 1 }], type: 'root', version: 1 } }, size: 'full' }] }],
        slug: MARK.toLowerCase(),
        title: `Page ${MARK}`,
      })).doc.id
    },
    async () => { if (pageId) await api('DELETE', `/pages/${pageId}`) },
    (p) => p.status === 200 && p.text.includes(MARK))

  // ------------------------------------------------------------ shop settings
  const doha = await one('shippingCities', 'where[active][equals]=true')
  await check('Delivery → Qatar city fee', ['/shipping-returns'],
    () => api('PATCH', `/shippingCities/${doha.id}`, { feeQar: 173 }).then(() => undefined),
    () => api('PATCH', `/shippingCities/${doha.id}`, { feeQar: doha.feeQar }).then(() => undefined),
    has('173'))
  const zone = await one('shippingZones', 'where[active][equals]=true')
  await check('Delivery → international zone fee', ['/shipping-returns'],
    () => api('PATCH', `/shippingZones/${zone.id}`, { feeQar: 1731 }).then(() => undefined),
    () => api('PATCH', `/shippingZones/${zone.id}`, { feeQar: zone.feeQar }).then(() => undefined),
    has('1,731'))

  const threads = (await api('GET', '/personalisationOptions?limit=100&depth=0&where[type][equals]=thread&where[active][not_equals]=false')).docs
  const count = (p: { text: string }) => Number(p.text.match(/one of (\d+) thread colours/)?.[1] ?? NaN)
  await check('Embroidery → switch a thread off', ['/'],
    () => api('PATCH', `/personalisationOptions/${threads[0].id}`, { active: false }).then(() => undefined),
    () => api('PATCH', `/personalisationOptions/${threads[0].id}`, { active: true }).then(() => undefined),
    (p) => count(p) === threads.length - 1)
  await check('Embroidery → rename a thread', ['/products/al-shaheen-nights'],
    () => api('PATCH', `/personalisationOptions/${threads[0].id}`, { name: `Thread ${MARK}` }).then(() => undefined),
    () => api('PATCH', `/personalisationOptions/${threads[0].id}`, { name: threads[0].name }).then(() => undefined),
    hasHtml(MARK))

  const segment = await one('spinSegments', 'where[active][equals]=true')
  await check('Reward wheel → segment label', ['/api/spin'],
    () => api('PATCH', `/spinSegments/${segment.id}`, { label: `Prize ${MARK}` }).then(() => undefined),
    () => api('PATCH', `/spinSegments/${segment.id}`, { label: segment.label }).then(() => undefined),
    hasHtml(MARK))

  const aed = await one('currencies', 'where[code][equals]=AED')
  await check('Currencies → hand-set price', ['/api/locale/options'],
    () => api('PATCH', `/currencies/${aed.id}`, { priceOverride: 1733 }).then(() => undefined),
    () => api('PATCH', `/currencies/${aed.id}`, { priceOverride: aed.priceOverride }).then(() => undefined),
    hasHtml('"price":1733'))
  const iran = await one('countries', 'where[code][equals]=IR')
  await check('Countries → blocked reason', ['/api/locale/options'],
    () => api('PATCH', `/countries/${iran.id}`, { blockedReason: `Reason ${MARK}` }).then(() => undefined),
    () => api('PATCH', `/countries/${iran.id}`, { blockedReason: iran.blockedReason }).then(() => undefined),
    hasHtml(MARK))

  // ------------------------------------------------------------------ report
  const pad = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s.padEnd(n))
  console.log(`\n${pad('What she changes', 38)} ${pad('Page', 30)} ${pad('Shows?', 18)} Undo shows?`)
  for (const r of results) console.log(`${pad(r.area, 38)} ${pad(r.page, 30)} ${pad(r.after, 18)} ${r.revert}`)
  const bad = results.filter((r) => !r.after.startsWith('yes, at once') || (r.revert && !r.revert.startsWith('yes, at once')))
  console.log(`\n${results.length - bad.length} of ${results.length} reflected at once.`)
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
