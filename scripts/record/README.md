# Tutorial videos for the client

Short split-screen videos, one task each: her admin on the left, her website
on the right, both the real site running on this machine. Every action on
camera goes through the admin's own screens — clicks, typing, the admin's own
upload control — never the API. See BUILD-LOG §44.

## What you need

- Docker, with the `plumpose-pg` container (port 5434). If another project's
  container holds 5434, stop it while recording.
- Her photographs in `../brand-assets/product/` (uploads use these) and the
  films in `public/video/` (`pnpm films:fetch`).
- ffmpeg on the PATH.

## The demo database

`plumpose_demo`, beside the test database, never Neon. The whole website is
in place — settings, delivery, embroidery, page text, FAQs, the films — and
**no products**; one admin, whose login is in `../recordings/demo-admin.json`
(outside the repository).

```bash
sh scripts/record/reset-demo.sh build   # once: migrate, seed, prepare, keep a copy
sh scripts/record/reset-demo.sh reset   # before every take (≈1 s) — stop the dev server first
```

## Recording one video

1. `sh scripts/record/reset-demo.sh reset`
2. Start the `plumpose-demo` launch entry (the dev server on :3001 against the demo database).
3. `npx tsx scripts/record/videos/<name>.ts` — a Chromium window opens and you
   can watch it work; `RECORD_HEADLESS=1` runs it unseen.
4. The video lands in `../recordings/<name>/`:
   - `<name>.mp4` — 1920×1080
   - `timeline.json` — every caption with its start and end, in seconds
   - `captions.srt` — the same as subtitles

A voiceover script written against `timeline.json` lines up with the actions:
each caption is one step, and the next action starts when its step ends.

If a take shows a bug, fix it, reset, and record again from the start.

## The voiceover script

```bash
npx tsx scripts/record/voiceover.ts <name> ["opening line"] ["closing line"]
```

writes `../recordings/<name>/voiceover-script.md` from the timeline: one line
per caption, its start and the time it has, for one ElevenLabs clip each.

## What every video covers

Every button and setting visible on the screens a video teaches is pointed at
and explained — including the ones the video does not use, and what happens
if she uses them (which ones email the customer, which are live at once).

The camera zooms to whatever is clicked or typed (`ZOOM`), pulls back to both
sides while the website reloads, and closes in on the change there. What a
video starts from is made off camera with `start({ setup })` and
`demo-data.ts` (a piece, its sizes, a paid order).

## Writing a video

```ts
import { Recording } from '../stage'

const r = new Recording('07-add-a-piece')
await r.start({ adminPath: '/admin', sitePath: '/shop', warm: ['/admin/collections/products/create'] })
await r.titleCard('Products', 'Add a new piece', ['Photos, price, sizes and stock'])
await r.say('Open Products and click Create new.')
await r.click(r.admin.getByRole('link', { name: 'Products' }).first())
await r.type(r.admin.locator('#field-title'), 'Al Shaheen Nights')
await r.upload(r.admin.getByRole('button', { name: /select a file/i }), '04-standing-window-full.jpg')
await r.showOnSite('/shop', (site) => site.getByText('Al Shaheen Nights'))
await r.recapCard('Add a new piece', ['…'])
await r.finish()
```

`stage.ts` has the helpers: `say` (caption, held long enough to read),
`click`, `type`, `upload`, `point`, `saved` (waits for the admin's own saved
message), `showOnSite` (reloads the website side until the change is there,
then flashes it), `titleCard`, `recapCard`, `finish`.

The website side hides, in the recording only, what a customer would not
see: the admin bar (the recorder is signed in), the development error badge,
and the reward wheel (marked as already seen).
