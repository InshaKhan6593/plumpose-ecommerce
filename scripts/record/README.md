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

1. `npx tsx scripts/record/narrate.ts <name>` — makes its voice (see below).
2. `sh scripts/record/reset-demo.sh reset`
3. Start the `plumpose-demo` launch entry (the dev server on :3001 against the demo database).
4. `npx tsx scripts/record/videos/<name>.ts` — a Chromium window opens and you
   can watch it work; `RECORD_HEADLESS=1` runs it unseen.
5. The video lands in `../recordings/<name>/`:
   - `<name>.mp4` — 1920×1080, narrated, opening on the title card
   - `timeline.json` — every caption with its start and end, in seconds
   - `captions.srt` — the same as subtitles
   - `voice/` — the voice clips, kept so a retake bills nothing

If a take shows a bug, fix it, reset, and record again from the start.

## The voice

Every `say('…')` caption, and each card's `speak:` line, is said in the
tutorials' voice (ElevenLabs, `voice.ts`; Alice by default, another with
`TUTORIAL_VOICE_ID`). `ELEVENLABS_API_KEY` is in `.env`.

```bash
npx tsx scripts/record/narrate.ts <name> --dry   # lines, and the characters it will bill
npx tsx scripts/record/narrate.ts <name>         # make them, before the take
```

Clips are cached by voice + words, so a retake bills nothing and a changed
line bills only itself. Keep captions plain string literals — `narrate.ts`
finds them in the video's source; one it missed is made mid-take and shows as
a pause.

On camera a line plays **while** its action happens (the pointer moves about
a second in), and the next line waits for it to end, so two never overlap and
the voice never runs past its step. `RECORD_VOICE=off` records silent, holding
each caption long enough to read.

`voiceover.ts` writes a script for voicing a silent take by hand, timed from
its `timeline.json` — only for videos recorded before the voice was built in.

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
await r.titleCard('Products', 'Add a new piece', ['Photos, price, sizes and stock'], { speak: 'How to add a new piece.' })
await r.say('Open Products and click Create new.')
await r.click(r.admin.getByRole('link', { name: 'Products' }).first())
await r.type(r.admin.locator('#field-title'), 'Al Shaheen Nights')
await r.upload(r.admin.getByRole('button', { name: /select a file/i }), '04-standing-window-full.jpg')
await r.showOnSite('/shop', (site) => site.getByText('Al Shaheen Nights'))
await r.recapCard('Add a new piece', ['…'], { speak: 'To recap: …' })
await r.finish()
```

`stage.ts` has the helpers: `say` (caption, held long enough to read),
`click`, `type`, `upload`, `point`, `saved` (waits for the admin's own saved
message), `showOnSite` (reloads the website side until the change is there,
then flashes it), `titleCard`, `recapCard`, `finish`.

The website side hides, in the recording only, what a customer would not
see: the admin bar (the recorder is signed in), the development error badge,
and the reward wheel (marked as already seen).
