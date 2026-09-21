import { chromium } from '@playwright/test'

/**
 * Logs in and dumps computed styles for a selector, so a layout bug can be
 * diagnosed without guessing at class names.
 *
 *   npx tsx scripts/inspect-one.ts "/admin/collections/products/1" "Price & sizes"
 */
const BASE = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
const [, , url, tabText] = process.argv

const run = async () => {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { height: 1000, width: 1600 } })

  await page.goto(`${BASE}/admin/login`, { timeout: 120_000, waitUntil: 'networkidle' })
  await page.fill('#field-email', 'dev@plumpose.local')
  await page.fill('#field-password', 'devpassword')
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/admin(?!\/login)/, { timeout: 120_000 })

  await page.goto(`${BASE}${url}`, { timeout: 120_000, waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  if (tabText) {
    await page.getByRole('button', { name: tabText }).first().click()
    await page.waitForTimeout(1200)
  }

  const info = await page.evaluate(() => {
    const out: any[] = []
    const inputs = [...document.querySelectorAll<HTMLInputElement>('input')]
    const input = inputs.find(
      (i) => i.type !== 'checkbox' && /priceInQAR$/.test(i.name || i.id || ''),
    )
    if (!input) {
      return {
        candidates: inputs.map((i) => ({ id: i.id, name: i.name, type: i.type, value: i.value })),
        found: false,
      }
    }

    let el: HTMLElement | null = input
    for (let i = 0; i < 4 && el; i++) {
      const cs = getComputedStyle(el)
      out.push({
        cls: el.className,
        tag: el.tagName,
        paddingLeft: cs.paddingLeft,
        position: cs.position,
        width: el.offsetWidth,
      })
      el = el.parentElement
    }

    // anything rendering the symbol
    const sibs = [...(input.parentElement?.children || [])].map((c) => ({
      cls: (c as HTMLElement).className,
      left: getComputedStyle(c as HTMLElement).left,
      position: getComputedStyle(c as HTMLElement).position,
      tag: c.tagName,
      text: (c as HTMLElement).innerText?.slice(0, 20),
      width: (c as HTMLElement).offsetWidth,
    }))

    return { chain: out, found: true, siblings: sibs }
  })

  console.log(JSON.stringify(info, null, 2))
  await browser.close()
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
