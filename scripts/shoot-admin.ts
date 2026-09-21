import { chromium } from '@playwright/test'
import fs from 'fs'
import path from 'path'

/**
 * Logs into the admin with the LOCAL DEV FIXTURE user (created by the seed,
 * never seeded in production) and screenshots every screen, so the panel can
 * be reviewed without a human clicking through it.
 *
 *   pnpm shoot:admin
 *
 * Output goes to .screenshots/ which is git-ignored.
 */

const BASE = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
const OUT = path.resolve('.screenshots')

const screens: Array<{ full?: boolean; name: string; url: string }> = [
  { name: '01-dashboard', url: '/admin' },
  { full: true, name: '02-products-list', url: '/admin/collections/products' },
  { full: true, name: '03-product-edit', url: '/admin/collections/products/1' },
  { full: true, name: '04-orders-list', url: '/admin/collections/orders' },
  { full: true, name: '05-media-list', url: '/admin/collections/media' },
  { full: true, name: '06-projects-list', url: '/admin/collections/projects' },
  { full: true, name: '07-faqs-list', url: '/admin/collections/faqs' },
  { full: true, name: '08-personalisation', url: '/admin/collections/personalisationOptions' },
  { full: true, name: '09-shipping-cities', url: '/admin/collections/shippingCities' },
  { full: true, name: '10-countries', url: '/admin/collections/countries' },
  { full: true, name: '11-currencies', url: '/admin/collections/currencies' },
  { full: true, name: '12-wheel', url: '/admin/collections/spinSegments' },
  { full: true, name: '13-discounts', url: '/admin/collections/discountCodes' },
  { full: true, name: '14-variants', url: '/admin/collections/variants' },
  { full: true, name: '15-site-settings', url: '/admin/globals/siteSettings' },
  { full: true, name: '16-users', url: '/admin/collections/users' },
]

const run = async () => {
  fs.mkdirSync(OUT, { recursive: true })

  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { height: 1000, width: 1600 } })

  // Local development fixture only — see src/seed/index.ts
  await page.goto(`${BASE}/admin/login`, { waitUntil: 'networkidle', timeout: 120_000 })
  await page.fill('#field-email', 'dev@plumpose.local')
  await page.fill('#field-password', 'devpassword')
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/admin(?!\/login)/, { timeout: 120_000 })
  console.log('  logged in as the dev fixture\n')

  for (const s of screens) {
    try {
      await page.goto(`${BASE}${s.url}`, { timeout: 120_000, waitUntil: 'networkidle' })
      await page.waitForTimeout(1200)
      const file = path.join(OUT, `${s.name}.png`)
      await page.screenshot({ fullPage: Boolean(s.full), path: file })
      console.log(`  ${s.name.padEnd(24)} ok`)
    } catch (err) {
      console.log(`  ${s.name.padEnd(24)} FAILED — ${(err as Error).message.split('\n')[0]}`)
    }
  }

  await browser.close()
  console.log(`\n  screenshots in ${OUT}\n`)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
