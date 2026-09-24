import { chromium, type Page } from '@playwright/test'

/**
 * How smooth does the storefront feel? Measured, not eyeballed.
 *
 *   npx tsx scripts/perf-probe.ts http://localhost:3000 [/ /shop …]
 *
 * For each page, in a real Chromium on this machine (GPU on):
 *   - load:   time to first byte, first paint, largest paint, JavaScript sent
 *   - main thread: long tasks (> 50 ms) while loading — each one is a moment
 *             a click or a scroll cannot be answered
 *   - intro and scroll: frame times while the intro plays and while the page
 *             is wheel-scrolled (Lenis) — frames over 50 ms are visible stutter
 *   - films:  dropped frames per playing video
 *   - clicks: how long the slowest click took to paint (Event Timing API)
 *
 * Compare `pnpm dev` with a production build: dev is far slower by design.
 */
const BASE = process.argv[2] || 'http://localhost:3000'
const PAGES = process.argv.slice(3).length ? process.argv.slice(3) : ['/', '/shop', '/products/al-shaheen-nights', '/our-story']

const collector = () => {
  const w = window as any
  w.__perf = { cls: 0, events: [] as number[], frames: [] as number[], lcp: 0, longTasks: [] as number[], rec: false }
  new PerformanceObserver((l) => l.getEntries().forEach((e) => w.__perf.longTasks.push(e.duration))).observe({ buffered: true, type: 'longtask' })
  new PerformanceObserver((l) => l.getEntries().forEach((e) => (w.__perf.lcp = e.startTime))).observe({ buffered: true, type: 'largest-contentful-paint' })
  new PerformanceObserver((l) => l.getEntries().forEach((e: any) => { if (!e.hadRecentInput) w.__perf.cls += e.value })).observe({ buffered: true, type: 'layout-shift' })
  new PerformanceObserver((l) => l.getEntries().forEach((e: any) => w.__perf.events.push(e.duration))).observe({ durationThreshold: 16, type: 'event' } as any)
  const loop = (t: number) => { if (w.__perf.rec) w.__perf.frames.push(t); requestAnimationFrame(loop) }
  requestAnimationFrame(loop)
  try { localStorage.setItem('plumpose:wheel', 'done') } catch {}
}

const frameStats = (times: number[]) => {
  const d = times.slice(1).map((t, i) => t - times[i])
  if (!d.length) return 'no frames'
  const sorted = [...d].sort((a, b) => a - b)
  const secs = (times[times.length - 1] - times[0]) / 1000
  const p95 = sorted[Math.floor(sorted.length * 0.95)]
  return `${(d.length / secs).toFixed(0)} fps · p95 ${p95.toFixed(0)} ms · ${d.filter((x) => x > 50).length} stutters >50 ms · worst ${sorted[sorted.length - 1].toFixed(0)} ms`
}

async function record(page: Page, ms: number, action?: () => Promise<void>) {
  await page.evaluate(() => { const w = window as any; w.__perf.frames = []; w.__perf.rec = true })
  if (action) await action()
  else await page.waitForTimeout(ms)
  return page.evaluate(() => { const w = window as any; w.__perf.rec = false; return w.__perf.frames as number[] })
}

async function run() {
  const browser = await chromium.launch({ args: ['--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--use-angle=d3d11'] })
  const context = await browser.newContext({ viewport: { height: 900, width: 1440 } })
  // tsx names functions with a `__name` helper, which does not exist inside the page.
  await context.addInitScript({ content: 'window.__name = (f) => f' })
  await context.addInitScript(collector)
  const page = await context.newPage()

  const gpu = await page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl') as WebGLRenderingContext | null
    const ext = gl?.getExtension('WEBGL_debug_renderer_info')
    return ext && gl ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'no WebGL'
  })
  console.log(`${BASE}  ·  GPU: ${gpu}\n`)

  for (const path of PAGES) {
    await page.goto(`${BASE}${path}`, { timeout: 180_000, waitUntil: 'load' })
    const intro = await record(page, 3000)

    const load = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
      const fcp = performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? 0
      const res = performance.getEntriesByType('resource') as PerformanceResourceTiming[]
      const kb = (f: (r: PerformanceResourceTiming) => boolean) => Math.round(res.filter(f).reduce((s, r) => s + (r.encodedBodySize || 0), 0) / 1024)
      const w = window as any
      return {
        cls: w.__perf.cls.toFixed(3),
        fcp: Math.round(fcp),
        js: kb((r) => r.initiatorType === 'script' || /\.js(\?|$)/.test(r.name)),
        lcp: Math.round(w.__perf.lcp),
        longCount: w.__perf.longTasks.length,
        longMs: Math.round(w.__perf.longTasks.reduce((s: number, x: number) => s + x, 0)),
        longWorst: Math.round(Math.max(0, ...w.__perf.longTasks)),
        ttfb: Math.round(nav.responseStart),
        video: kb((r) => /\/video\//.test(r.name)),
      }
    })

    // Films: dropped frames over four seconds of play.
    const films = await page.evaluate(async () => {
      const vids = [...document.querySelectorAll('video')].filter((v) => !v.paused)
      const before = vids.map((v) => v.getVideoPlaybackQuality())
      await new Promise((r) => setTimeout(r, 4000))
      return vids.map((v, i) => {
        const q = v.getVideoPlaybackQuality()
        const total = q.totalVideoFrames - before[i].totalVideoFrames
        const dropped = q.droppedVideoFrames - before[i].droppedVideoFrames
        return `${(v.currentSrc.split('/').pop() || '').padEnd(18)} ${v.videoWidth}×${v.videoHeight} · ${dropped}/${total} frames dropped`
      })
    })

    // Scroll the way a visitor does: wheel ticks, which Lenis smooths.
    await page.mouse.move(720, 450)
    const scroll = await record(page, 0, async () => {
      for (let i = 0; i < 40; i++) {
        await page.mouse.wheel(0, 140)
        await page.waitForTimeout(60)
      }
      await page.waitForTimeout(1200)
    })
    // While the page is scrolled part way: which films are still playing (and dropping)?
    const filmsScrolled = await page.evaluate(() =>
      [...document.querySelectorAll('video')].map((v) => `${(v.currentSrc.split('/').pop() || '').padEnd(18)} ${v.paused ? 'paused' : 'PLAYING'}`),
    )

    // A click on something interactive, then how long the page took to answer it.
    await page.evaluate(() => ((window as any).__perf.events = []))
    const target = page.locator('button:visible').first()
    await target.click({ timeout: 5000 }).catch(() => undefined)
    await page.waitForTimeout(800)
    const clicks = await page.evaluate(() => (window as any).__perf.events as number[])

    console.log(`■ ${path}`)
    console.log(`  load      first byte ${load.ttfb} ms · first paint ${load.fcp} ms · largest paint ${load.lcp} ms · layout shift ${load.cls}`)
    console.log(`  sent      JavaScript ${load.js} KB · film ${load.video} KB so far`)
    console.log(`  blocking  ${load.longCount} long tasks, ${load.longMs} ms in total, worst ${load.longWorst} ms`)
    console.log(`  intro     ${frameStats(intro)}`)
    console.log(`  scroll    ${frameStats(scroll)}`)
    for (const f of films) console.log(`  film      ${f}`)
    for (const f of filmsScrolled) console.log(`  scrolled  ${f}`)
    console.log(`  click     ${clicks.length ? `slowest answered in ${Math.round(Math.max(...clicks))} ms` : 'answered within a frame'}\n`)
  }

  await browser.close()
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
