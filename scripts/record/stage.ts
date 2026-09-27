/**
 * The split-screen stage the tutorial videos are recorded on.
 *
 * One 1920×1080 page, served at http://localhost:3001/__stage by a Playwright
 * route (so it is same-origin with the site and may frame the admin), holding
 * two live iframes: the admin on the left, her website on the right. Both are
 * the real localhost site — every action goes through the admin's own screens
 * (click, type, upload); nothing is done through the API on camera.
 *
 * Over them: a pointer that glides to what is used, a ring around it, a
 * caption bar, title and recap cards, and a badge when the website side
 * updates. Each caption is a step in the timeline written beside the video
 * (timeline.json + captions.srt), timed from the start of the video, so a
 * voiceover script can be matched to it.
 *
 * Nothing here changes the site; the overlay exists only on the stage page.
 */
import type { Browser, BrowserContext, FrameLocator, Locator, Page } from '@playwright/test'

import { chromium } from '@playwright/test'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

export const BASE = process.env.RECORD_BASE ?? 'http://localhost:3001'
export const OUT_ROOT = path.resolve(process.cwd(), '..', 'recordings')
export const PHOTOS = path.resolve(process.cwd(), '..', 'brand-assets', 'product')

const W = 1920
const H = 1080
const PANE_W = 950
const PANE_H = 880
/** The admin and the site render at 1280 wide, shown at 950 — a laptop screen, scaled. */
const INNER_W = 1280
const SCALE = PANE_W / INNER_W

type Step = { caption: string; end: number; index: number; start: number }

const stageHtml = (title: string) => `<!doctype html>
<html><head><meta charset="utf-8"><title>${title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<style>
  :root { --paper:#f4f1ec; --ink:#1d1a17; --muted:#7a7068; --accent:#8a6a4a; }
  html,body { margin:0; width:${W}px; height:${H}px; overflow:hidden; background:var(--paper);
    font-family: "Jost", "Segoe UI", system-ui, sans-serif; color:var(--ink); }
  .pane { position:absolute; top:44px; width:${PANE_W}px; height:${PANE_H}px; overflow:hidden;
    border-radius:10px; background:#fff; box-shadow:0 1px 0 rgba(0,0,0,.06), 0 8px 30px rgba(0,0,0,.08); }
  .pane.left { left:${(W / 2 - PANE_W) / 2 | 0}px; }
  .pane.right { left:${(W / 2 + (W / 2 - PANE_W) / 2) | 0}px; transition: box-shadow .3s; }
  .pane iframe { border:0; width:${INNER_W}px; height:${Math.round(PANE_H / SCALE)}px;
    transform:scale(${SCALE}); transform-origin:0 0; }
  .label { position:absolute; top:14px; font-size:13px; letter-spacing:.14em; text-transform:uppercase; color:var(--muted); }
  .label.left { left:${(W / 2 - PANE_W) / 2 | 0}px; }
  .label.right { left:${(W / 2 + (W / 2 - PANE_W) / 2) | 0}px; }
  .pane.right.flash { box-shadow:0 0 0 4px var(--accent), 0 8px 30px rgba(0,0,0,.12); }
  #badge { position:absolute; top:60px; right:${((W / 2 - PANE_W) / 2 + 16) | 0}px; padding:8px 14px; border-radius:999px;
    background:var(--accent); color:#fff; font-size:15px; opacity:0; transform:translateY(-6px); transition:all .35s; z-index:5; }
  #badge.on { opacity:1; transform:none; }
  #caption { position:absolute; left:0; right:0; bottom:0; height:${H - 44 - PANE_H - 16}px; display:flex; align-items:center;
    justify-content:center; padding:0 80px; font-size:30px; line-height:1.25; text-align:center; }
  #caption span { transition:opacity .25s; }
  #card { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center;
    background:var(--paper); z-index:20; transition:opacity .5s; }
  #card.off { opacity:0; pointer-events:none; }
  #card .kicker { font-size:16px; letter-spacing:.2em; text-transform:uppercase; color:var(--muted); }
  #card h1 { font-family: Georgia, "Times New Roman", serif; font-weight:400; font-size:64px; margin:.25em 0 .3em; }
  #card p { font-size:24px; color:var(--muted); max-width:1100px; text-align:center; margin:.2em 0; }
  #card ol { font-size:26px; line-height:1.6; margin:.6em 0 0; }
  #ring { position:absolute; border:3px solid var(--accent); border-radius:8px; pointer-events:none; opacity:0;
    transition:all .25s ease; z-index:10; box-shadow:0 0 0 6px rgba(138,106,74,.18); }
  #ring.on { opacity:1; }
  #cursor { position:absolute; left:0; top:0; width:26px; height:26px; pointer-events:none; z-index:30;
    transform:translate(${W / 2}px, ${H / 2}px); }
  #cursor svg { filter: drop-shadow(0 2px 3px rgba(0,0,0,.35)); }
  #cursor.press svg { transform:scale(.85); transform-origin:4px 4px; }
</style></head><body>
  <div class="label left">Your admin</div><div class="label right">Your website</div>
  <div class="pane left"><iframe name="admin" src="about:blank"></iframe></div>
  <div class="pane right" id="sitePane"><iframe name="site" src="about:blank"></iframe></div>
  <div id="badge">Updated on your website</div>
  <div id="ring"></div>
  <div id="caption"><span></span></div>
  <div id="card"></div>
  <div id="cursor"><svg width="26" height="26" viewBox="0 0 26 26"><path d="M4 3 L4 21 L9 16.5 L12.5 24 L15.5 22.7 L12 15.3 L19 15.3 Z"
    fill="#fff" stroke="#1d1a17" stroke-width="1.6" stroke-linejoin="round"/></svg></div>
</body></html>`

export class Recording {
  admin!: FrameLocator
  site!: FrameLocator
  page!: Page
  private browser!: Browser
  private context!: BrowserContext
  private cursor = { x: W / 2, y: H / 2 }
  private open: null | Omit<Step, 'end'> = null
  private readonly steps: Step[] = []
  private t0 = 0
  readonly dir: string

  constructor(readonly name: string) {
    this.dir = path.join(OUT_ROOT, name)
  }

  /** Signs in off camera, warms the pages the video uses, then starts recording on the stage. */
  async start(options: { adminPath: string; sitePath: string; warm?: string[] }) {
    // Empty the folder rather than remove it: Windows refuses while anything has it open.
    fs.mkdirSync(this.dir, { recursive: true })
    for (const f of fs.readdirSync(this.dir)) fs.rmSync(path.join(this.dir, f), { force: true, recursive: true })
    const login = JSON.parse(fs.readFileSync(path.join(OUT_ROOT, 'demo-admin.json'), 'utf8'))

    this.browser = await chromium.launch({ headless: process.env.RECORD_HEADLESS === '1' })

    // Off camera: sign in, and load every page once so none is compiled on camera.
    const prep = await this.browser.newContext({ viewport: { height: 900, width: INNER_W } })
    const p = await prep.newPage()
    await p.goto(`${BASE}/admin/login`)
    await p.fill('#field-email', login.email)
    await p.fill('#field-password', login.password)
    await p.click('button[type=submit]')
    await p.waitForURL(`${BASE}/admin`)
    for (const url of [options.adminPath, options.sitePath, ...(options.warm ?? [])]) {
      await p.goto(`${BASE}${url}`, { waitUntil: 'networkidle' }).catch(() => undefined)
    }
    // A returning visitor: the reward wheel has been seen, so it does not cover the website side.
    await p.evaluate(() => window.localStorage.setItem('plumpose:wheel', 'closed'))
    const storageState = await prep.storageState()
    await prep.close()

    this.context = await this.browser.newContext({
      recordVideo: { dir: this.dir, size: { height: H, width: W } },
      storageState,
      viewport: { height: H, width: W },
    })
    this.t0 = Date.now()
    this.page = await this.context.newPage()
    await this.page.route(`${BASE}/__stage`, (route) =>
      route.fulfill({ body: stageHtml(this.name), contentType: 'text/html' }),
    )
    await this.page.goto(`${BASE}/__stage`)
    this.admin = this.page.frameLocator('iframe[name=admin]')
    this.site = this.page.frameLocator('iframe[name=site]')
    await Promise.all([this.goAdmin(options.adminPath), this.goSite(options.sitePath)])
  }

  private frame(name: 'admin' | 'site') {
    return this.page.frame({ name })!
  }

  async goAdmin(url: string) {
    await this.frame('admin').goto(`${BASE}${url}`, { waitUntil: 'networkidle' })
    await this.tidy('admin')
  }

  async goSite(url: string) {
    await this.frame('site').goto(`${BASE}${url}`, { waitUntil: 'networkidle' })
    await this.tidy('site')
  }

  /**
   * What a customer would not see: the admin bar (shown because the recorder
   * is signed in) and the development error badge. Hidden in the recording's
   * view only — the site is unchanged.
   */
  private async tidy(name: 'admin' | 'site') {
    await this.frame(name).addStyleTag({
      content: `nextjs-portal { display: none !important; }
        ${name === 'site' ? 'div:has(> .container #payload-admin-bar) { display: none !important; }' : ''}`,
    })
  }

  /* ------------------------------------------------------------ timeline */

  private now() {
    return (Date.now() - this.t0) / 1000
  }

  /** A caption on screen, held long enough to read (≈ 2.6 words a second, at least 2.2 s). */
  async say(caption: string, hold?: number) {
    this.close()
    this.open = { caption, index: this.steps.length + 1, start: this.now() }
    await this.page.evaluate((text) => {
      const span = document.querySelector('#caption span') as HTMLElement
      span.style.opacity = '0'
      setTimeout(() => {
        span.textContent = text
        span.style.opacity = '1'
      }, 200)
    }, caption)
    const words = caption.split(/\s+/).length
    await this.page.waitForTimeout((hold ?? Math.max(2.2, words / 2.6)) * 1000)
  }

  private close() {
    if (this.open) this.steps.push({ ...this.open, end: this.now() })
    this.open = null
  }

  /* -------------------------------------------------------------- cards */

  async titleCard(kicker: string, title: string, lines: string[] = [], hold = 3.5) {
    await this.card(
      `<div class="kicker">${kicker}</div><h1>${title}</h1>${lines.map((l) => `<p>${l}</p>`).join('')}`,
      hold,
      `${kicker}: ${title}`,
    )
  }

  async recapCard(title: string, points: string[], hold = 6) {
    await this.card(
      `<div class="kicker">Remember</div><h1>${title}</h1><ol>${points.map((p) => `<li>${p}</li>`).join('')}</ol>`,
      hold,
      `Remember — ${points.join(' · ')}`,
    )
  }

  private async card(html: string, hold: number, caption: string) {
    this.close()
    this.open = { caption, index: this.steps.length + 1, start: this.now() }
    await this.page.evaluate((h) => {
      const card = document.getElementById('card')!
      card.innerHTML = h
      card.classList.remove('off')
    }, html)
    await this.page.waitForTimeout(hold * 1000)
    await this.page.evaluate(() => document.getElementById('card')!.classList.add('off'))
    await this.page.waitForTimeout(500)
  }

  /* ------------------------------------------------------------ pointer */

  private async glideTo(target: Locator) {
    await target.scrollIntoViewIfNeeded()
    await this.page.waitForTimeout(250)
    const box = await target.boundingBox()
    if (!box) throw new Error(`Not on screen: ${target}`)
    const to = { x: box.x + Math.min(box.width / 2, 60), y: box.y + box.height / 2 }
    const steps = 24
    const from = { ...this.cursor }
    await this.page.evaluate(
      (b) => {
        const ring = document.getElementById('ring')!
        Object.assign(ring.style, {
          height: `${b.height + 12}px`,
          left: `${b.x - 6}px`,
          top: `${b.y - 6}px`,
          width: `${b.width + 12}px`,
        })
        ring.classList.add('on')
      },
      box,
    )
    for (let i = 1; i <= steps; i++) {
      const t = i / steps
      const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2
      const x = from.x + (to.x - from.x) * e
      const y = from.y + (to.y - from.y) * e
      await this.page.evaluate(
        ([cx, cy]) => {
          document.getElementById('cursor')!.style.transform = `translate(${cx}px, ${cy}px)`
        },
        [x, y],
      )
      await this.page.waitForTimeout(16)
    }
    this.cursor = to
  }

  private async unring() {
    await this.page.evaluate(() => document.getElementById('ring')!.classList.remove('on'))
  }

  private async press() {
    await this.page.evaluate(() => document.getElementById('cursor')!.classList.add('press'))
    await this.page.waitForTimeout(120)
    await this.page.evaluate(() => document.getElementById('cursor')!.classList.remove('press'))
  }

  /* ------------------------------------------------------------ actions */

  async click(target: Locator, pause = 350) {
    await this.glideTo(target)
    await this.page.waitForTimeout(pause)
    await this.press()
    await target.click()
    await this.page.waitForTimeout(300)
    await this.unring()
  }

  /** Types into a box one letter at a time, as she would. */
  async type(target: Locator, text: string, { clear = true, delay = 55 } = {}) {
    await this.glideTo(target)
    await this.press()
    await target.click()
    if (clear) await target.fill('')
    await target.pressSequentially(text, { delay })
    await this.page.waitForTimeout(300)
    await this.unring()
  }

  /**
   * Clicks the admin's own upload control and answers the file window with
   * her photograph. The Windows file window cannot be filmed; say so first.
   */
  async upload(control: Locator, file: string) {
    await this.glideTo(control)
    await this.press()
    const chooser = this.page.waitForEvent('filechooser')
    await control.click()
    await (await chooser).setFiles(path.join(PHOTOS, file))
    await this.page.waitForTimeout(600)
    await this.unring()
  }

  async point(target: Locator, hold = 1.2) {
    await this.glideTo(target)
    await this.page.waitForTimeout(hold * 1000)
    await this.unring()
  }

  /** Waits for the admin's own "saved" message. */
  async saved() {
    await this.admin.locator('.payload-toast-container, [data-sonner-toaster]').getByText(/success|saved|published|updated/i).first().waitFor({ timeout: 20_000 })
    await this.page.waitForTimeout(800)
  }

  /**
   * Shows the change on the website side: reloads the page until `until`
   * appears (the site may take a moment to refresh), then flashes the pane.
   */
  async showOnSite(url: string, until: (site: FrameLocator) => Locator, tries = 10) {
    for (let i = 0; i < tries; i++) {
      await this.goSite(url)
      if (await until(this.site).first().isVisible().catch(() => false)) break
      await this.page.waitForTimeout(1500)
    }
    const found = until(this.site).first()
    await found.scrollIntoViewIfNeeded()
    await this.page.evaluate(() => {
      document.getElementById('sitePane')!.classList.add('flash')
      document.getElementById('badge')!.classList.add('on')
    })
    await this.point(found, 1.4)
    await this.page.waitForTimeout(1200)
    await this.page.evaluate(() => {
      document.getElementById('sitePane')!.classList.remove('flash')
      document.getElementById('badge')!.classList.remove('on')
    })
  }

  /* -------------------------------------------------------------- finish */

  async finish() {
    this.close()
    const video = this.page.video()
    await this.context.close()
    await this.browser.close()
    const webm = await video!.path()
    const mp4 = path.join(this.dir, `${this.name}.mp4`)
    const encode = spawnSync(
      'ffmpeg',
      ['-y', '-loglevel', 'error', '-ss', '0.4', '-i', webm, '-c:v', 'libx264', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4],
      { stdio: 'inherit' },
    )
    if (encode.status === 0) fs.rmSync(webm)
    // The first 0.4 s (a blank frame) is trimmed; shift the timeline with it.
    const steps = this.steps.map((s) => ({ ...s, end: +(s.end - 0.4).toFixed(2), start: +Math.max(0, s.start - 0.4).toFixed(2) }))
    fs.writeFileSync(path.join(this.dir, 'timeline.json'), JSON.stringify({ steps, video: `${this.name}.mp4` }, null, 2))
    fs.writeFileSync(path.join(this.dir, 'captions.srt'), toSrt(steps))
    console.log(`recorded ${mp4} — ${steps.length} steps, ${steps.at(-1)?.end ?? 0}s`)
  }
}

const stamp = (s: number) => {
  const ms = Math.round(s * 1000)
  const pad = (n: number, w = 2) => String(n).padStart(w, '0')
  return `${pad(Math.floor(ms / 3_600_000))}:${pad(Math.floor(ms / 60_000) % 60)}:${pad(Math.floor(ms / 1000) % 60)},${pad(ms % 1000, 3)}`
}

const toSrt = (steps: Step[]) =>
  steps.map((s, i) => `${i + 1}\n${stamp(s.start)} --> ${stamp(s.end)}\n${s.caption}\n`).join('\n')
