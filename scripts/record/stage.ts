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
 * Narrated (the default; RECORD_VOICE=off for a silent take): each caption
 * and each card's `speak` line is said in the tutorials' voice (voice.ts), and
 * the step holds until it has been said. Make the clips first with
 * `npx tsx scripts/record/narrate.ts <video>`, or a missing one is made
 * mid-take and shows as a pause.
 *
 * Nothing here changes the site; the overlay exists only on the stage page.
 */
import type { APIRequestContext, Browser, BrowserContext, FrameLocator, Locator, Page } from '@playwright/test'

import { chromium } from '@playwright/test'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

import { type Clip, mixVoice, Voice } from './voice'

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
/** The caption bar across the bottom; the camera frames the screen above it. */
const CAPTION_H = H - 44 - PANE_H - 16
const VIEW_H = H - CAPTION_H
/** Where the panes end, in stage pixels — the camera never shows below it. */
const WORLD_BOTTOM = 44 + PANE_H + 8
/** How close the camera comes to what is being used: text reads at a laptop's size or larger. */
const ZOOM = 1.75
/** The voice starts as its caption finishes fading in, and the step holds a breath after it ends. */
const VOICE_LEAD = 0.25
const VOICE_TAIL = 0.45
/**
 * How long a line plays before the pointer moves. The action then happens
 * while the line is said — a line held to its end left the ring on the
 * previous field while the voice described the next one.
 */
const VOICE_BEAT = 1.1

type Rect = { height: number; width: number; x: number; y: number }

type Step = { caption: string; end: number; index: number; start: number }

/** `speak`: a plain string literal, so narrate.ts can find it and make its clip before the take. */
type CardOptions = { hold?: number; speak?: string }

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
  /* Fixed: a fixed box adds no scrollable area, so scrolling a field into view inside the
     admin can no longer scroll the stage itself (it did, and every ring landed off target). */
  #world { position:fixed; left:0; top:0; width:${W}px; height:${H}px; transform-origin:0 0;
    transition:transform .9s cubic-bezier(.45,0,.2,1); will-change:transform; }
  #caption { position:absolute; left:0; right:0; bottom:0; height:${CAPTION_H}px; display:flex; align-items:center;
    justify-content:center; padding:0 80px; font-size:32px; line-height:1.25; text-align:center; z-index:15;
    background:var(--paper); box-shadow:0 -10px 24px rgba(244,241,236,.95); }
  #caption span { transition:opacity .25s; }
  #card { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center;
    background:var(--paper); z-index:40; transition:opacity .5s; }
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
  <div id="world">
    <div class="label left">Your admin</div><div class="label right">Your website</div>
    <div class="pane left"><iframe name="admin" src="about:blank"></iframe></div>
    <div class="pane right" id="sitePane"><iframe name="site" src="about:blank"></iframe></div>
    <div id="badge">Updated on your website</div>
  </div>
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
  /** The camera: stage pixel p shows at p × z + t. */
  private cam = { tx: 0, ty: 0, z: 1 }
  private open: null | Omit<Step, 'end'> = null
  private readonly steps: Step[] = []
  private t0 = 0
  private readonly spoken: { at: number; file: string }[] = []
  /** When the line being said ends (ms, wall clock); the next line waits for it. */
  private quietAt = 0
  private readonly voice: null | Voice
  readonly dir: string

  constructor(readonly name: string) {
    this.dir = path.join(OUT_ROOT, name)
    this.voice = process.env.RECORD_VOICE === 'off' ? null : new Voice(this.dir)
  }

  /** The line's clip, before its step opens, so a clip made mid-take never shifts the timeline. */
  private async clipFor(line: string | undefined): Promise<Clip | null> {
    if (!this.voice || !line) return null
    const have = this.voice.cached(line)
    if (have) return have
    console.warn(`voice: making "${line}" mid-take — run narrate.ts first to keep it out of the video`)
    return this.voice.clip(line)
  }

  /** Plays the clip from now; returns how long it takes, with a breath after. */
  private speak(clip: Clip | null) {
    if (!clip) return 0
    this.spoken.push({ at: this.now() + VOICE_LEAD, file: clip.file })
    const takes = VOICE_LEAD + clip.duration + VOICE_TAIL
    this.quietAt = Date.now() + takes * 1000
    return takes
  }

  /** Waits for the line being said to end, so two lines never overlap. */
  private async untilQuiet() {
    const wait = this.quietAt - Date.now()
    if (wait > 0) await this.page.waitForTimeout(wait)
  }

  /** Signs in off camera, warms the pages the video uses, then starts recording on the stage. */
  async start(options: {
    adminPath: string
    /** Off camera, signed in: make what the video starts from (see demo-data.ts). */
    setup?: (api: APIRequestContext) => Promise<void>
    /** Off camera, after setup: use the website as a customer would — for example, fill the bag. */
    prepare?: (page: Page) => Promise<void>
    sitePath: string
    warm?: string[]
  }) {
    /*
     * Only a stopped take's raw .webm is cleared. The last finished video, its
     * timeline and anything written beside it (a voiceover script) stay until
     * this take finishes and replaces them: emptying the folder here lost a
     * finished video and its script when a take was stopped part-way.
     */
    fs.mkdirSync(this.dir, { recursive: true })
    for (const f of fs.readdirSync(this.dir)) {
      if (f.endsWith('.webm') || f === 'failure.png') fs.rmSync(path.join(this.dir, f), { force: true })
    }
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
    if (options.setup) await options.setup(prep.request)
    if (options.prepare) await options.prepare(p)
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

  /**
   * A caption on screen. Narrated, it is said while the actions after it
   * happen, and the next caption waits for it to end. Silent, it is held long
   * enough to read (≈ 2.2 words a second, at least 2.4 s — at 2.6 a calm
   * voiceover ran past the shorter steps).
   */
  async say(caption: string, hold?: number) {
    const clip = await this.clipFor(caption)
    await this.untilQuiet()
    this.close()
    this.open = { caption, index: this.steps.length + 1, start: this.now() }
    this.speak(clip)
    await this.page.evaluate((text) => {
      const span = document.querySelector('#caption span') as HTMLElement
      span.style.opacity = '0'
      setTimeout(() => {
        span.textContent = text
        span.style.opacity = '1'
      }, 200)
    }, caption)
    const words = caption.split(/\s+/).length
    await this.page.waitForTimeout((clip ? Math.max(hold ?? 0, VOICE_BEAT) : (hold ?? Math.max(2.4, words / 2.2))) * 1000)
  }

  private close() {
    if (this.open) this.steps.push({ ...this.open, end: this.now() })
    this.open = null
  }

  /* -------------------------------------------------------------- cards */

  /** `speak`: a line said over the card (narrated takes); the card holds until it ends. */
  async titleCard(kicker: string, title: string, lines: string[] = [], { hold = 3.5, speak }: CardOptions = {}) {
    await this.card(
      `<div class="kicker">${kicker}</div><h1>${title}</h1>${lines.map((l) => `<p>${l}</p>`).join('')}`,
      hold,
      `${kicker}: ${title}`,
      speak,
    )
  }

  async recapCard(title: string, points: string[], { hold = 6, speak }: CardOptions = {}) {
    await this.card(
      `<div class="kicker">Remember</div><h1>${title}</h1><ol>${points.map((p) => `<li>${p}</li>`).join('')}</ol>`,
      hold,
      `Remember — ${points.join(' · ')}`,
      speak,
    )
  }

  private async card(html: string, hold: number, caption: string, line?: string) {
    const clip = await this.clipFor(line)
    await this.untilQuiet()
    this.close()
    this.open = { caption, index: this.steps.length + 1, start: this.now() }
    hold = Math.max(hold, this.speak(clip) + 0.3)
    await this.page.evaluate((h) => {
      const card = document.getElementById('card')!
      card.innerHTML = h
      card.classList.remove('off')
    }, html)
    // Behind the card, back to the whole stage, so each section opens wide.
    const t = Date.now()
    await this.overview()
    await this.page.waitForTimeout(Math.max(0, hold * 1000 - (Date.now() - t)))
    await this.page.evaluate(() => document.getElementById('card')!.classList.add('off'))
    await this.page.waitForTimeout(500)
  }

  /* ------------------------------------------------------------ pointer */

  /* ------------------------------------------------------------- camera */

  private toWorld(box: Rect): Rect {
    const { tx, ty, z } = this.cam
    return { height: box.height / z, width: box.width / z, x: (box.x - tx) / z, y: (box.y - ty) / z }
  }

  /** Moves the camera to frame `rect` (stage pixels) at `zoom`, kept inside the stage. */
  private async moveCamera(rect: null | Rect, zoom: number) {
    let z = 1
    let tx = 0
    let ty = 0
    if (rect && zoom > 1) {
      // A big target gets less zoom, so all of it stays in view.
      z = Math.max(1, Math.min(zoom, (0.9 * W) / rect.width, (0.8 * VIEW_H) / rect.height))
      const cx = rect.x + rect.width / 2
      const cy = rect.y + rect.height / 2
      tx = Math.min(0, Math.max(W - W * z, W / 2 - cx * z))
      ty = Math.min(0, Math.max(VIEW_H - WORLD_BOTTOM * z, VIEW_H / 2 - cy * z))
    }
    const same = Math.abs(z - this.cam.z) < 0.02 && Math.abs(tx - this.cam.tx) < 4 && Math.abs(ty - this.cam.ty) < 4
    if (same) return
    this.cam = { tx, ty, z }
    await this.page.evaluate(
      ([x, y, s]) => {
        document.getElementById('world')!.style.transform = `translate(${x}px, ${y}px) scale(${s})`
      },
      [tx, ty, z],
    )
    await this.page.waitForTimeout(950)
  }

  /** Is the box (screen pixels) comfortably inside the view at the zoom wanted? */
  private framed(box: Rect, zoom: number) {
    if (Math.abs(this.cam.z - zoom) > 0.3) return false
    const m = 0.12
    return (
      box.x > W * m && box.x + box.width < W * (1 - m) && box.y > VIEW_H * m && box.y + box.height < VIEW_H * (1 - m)
    )
  }

  /** Back to the whole stage: both sides at once. */
  async overview() {
    await this.moveCamera(null, 1)
  }

  /** Brings a target into view with the camera, following as she works. */
  /**
   * The box once it has stopped moving. A page still scrolling (smoothly, or
   * as a section above it renders) put the ring on the field above — the
   * gift note's ring landed on Admin notes.
   */
  private async settledBox(target: Locator) {
    let last = await target.boundingBox()
    for (let i = 0; i < 15; i++) {
      await this.page.waitForTimeout(100)
      const next = await target.boundingBox()
      if (last && next && Math.abs(next.x - last.x) < 1 && Math.abs(next.y - last.y) < 1) return next
      last = next
    }
    return last
  }

  private async bringIntoView(target: Locator, zoom = ZOOM) {
    await target.scrollIntoViewIfNeeded()
    await this.page.waitForTimeout(150)
    let box = await this.settledBox(target)
    if (!box) throw new Error(`Not on screen: ${target}`)
    const wanted = Math.max(1, Math.min(zoom, (0.9 * W) / (box.width / this.cam.z), (0.8 * VIEW_H) / (box.height / this.cam.z)))
    if (!this.framed(box, wanted)) {
      await this.moveCamera(this.toWorld(box), zoom)
      box = await this.settledBox(target)
      if (!box) throw new Error(`Not on screen: ${target}`)
    }
    return box
  }

  private async glideTo(target: Locator, zoom = ZOOM) {
    const box = await this.bringIntoView(target, zoom)
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

  /**
   * `force` clicks at the spot even when something else takes the click
   * there — a list row, where the whole row opens the item.
   */
  async click(target: Locator, pause = 350, { force = false } = {}) {
    await this.glideTo(target)
    await this.page.waitForTimeout(pause)
    await this.press()
    await target.click({ force })
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

  async point(target: Locator, hold = 1.2, zoom = ZOOM) {
    await this.glideTo(target, zoom)
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
  async showOnSite(url: string, until: (site: FrameLocator) => Locator, { tries = 10, zoom = 1.5 } = {}) {
    // Pull back so both sides show while the website reloads, then close in on the change.
    await this.overview()
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
    await this.page.waitForTimeout(900)
    await this.point(found, 1.4, zoom)
    await this.page.waitForTimeout(1200)
    await this.page.evaluate(() => {
      document.getElementById('sitePane')!.classList.remove('flash')
      document.getElementById('badge')!.classList.remove('on')
    })
  }

  /* -------------------------------------------------------------- finish */

  /**
   * Runs the video's steps; if one fails, saves what the stage showed at that
   * moment as failure.png beside the video and closes the browser, so a broken
   * take says where it broke.
   */
  async run(steps: () => Promise<void>) {
    try {
      await steps()
    } catch (error) {
      await this.page?.screenshot({ path: path.join(this.dir, 'failure.png') }).catch(() => undefined)
      console.error(`failed at step ${this.open?.index ?? '?'} "${this.open?.caption ?? ''}" — see ${path.join(this.dir, 'failure.png')}`)
      await this.browser?.close().catch(() => undefined)
      throw error
    }
  }

  async finish() {
    await this.untilQuiet()
    this.close()
    const video = this.page.video()
    await this.context.close()
    await this.browser.close()
    const webm = await video!.path()
    const mp4 = path.join(this.dir, `${this.name}.mp4`)
    // The video opens on the first card: before it, the stage was blank while both sides loaded (13 s in 04).
    const trim = Math.max(0.4, (this.steps[0]?.start ?? 0.4) - 0.3)
    const encode = spawnSync(
      'ffmpeg',
      ['-y', '-loglevel', 'error', '-ss', trim.toFixed(2), '-i', webm, '-c:v', 'libx264', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4],
      { stdio: 'inherit' },
    )
    if (encode.status === 0) fs.rmSync(webm)
    // What was trimmed from the start comes off the voice and the timeline too.
    if (encode.status === 0 && this.spoken.length) {
      const silent = path.join(this.dir, `${this.name}.silent.mp4`)
      fs.renameSync(mp4, silent)
      const clips = this.spoken.map((c) => ({ ...c, at: c.at - trim }))
      if (mixVoice(silent, clips, mp4)) fs.rmSync(silent)
      else fs.renameSync(silent, mp4)
    }
    const steps = this.steps.map((s) => ({ ...s, end: +(s.end - trim).toFixed(2), start: +Math.max(0, s.start - trim).toFixed(2) }))
    fs.writeFileSync(path.join(this.dir, 'timeline.json'), JSON.stringify({ steps, video: `${this.name}.mp4` }, null, 2))
    fs.writeFileSync(path.join(this.dir, 'captions.srt'), toSrt(steps))
    console.log(`recorded ${mp4} — ${steps.length} steps, ${steps.at(-1)?.end ?? 0}s${this.spoken.length ? `, ${this.spoken.length} lines voiced` : ''}`)
  }
}

const stamp = (s: number) => {
  const ms = Math.round(s * 1000)
  const pad = (n: number, w = 2) => String(n).padStart(w, '0')
  return `${pad(Math.floor(ms / 3_600_000))}:${pad(Math.floor(ms / 60_000) % 60)}:${pad(Math.floor(ms / 1000) % 60)},${pad(ms % 1000, 3)}`
}

const toSrt = (steps: Step[]) =>
  steps.map((s, i) => `${i + 1}\n${stamp(s.start)} --> ${stamp(s.end)}\n${s.caption}\n`).join('\n')
