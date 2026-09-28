/**
 * The tutorials' voice: one ElevenLabs clip per spoken line, cached in
 * ../recordings/<video>/voice/ under a hash of the voice, its settings and the
 * words, so a retake — or a changed line — re-bills only what changed.
 *
 * The clips are made before a take (`narrate.ts`), because the stage holds
 * each step for as long as its line takes to say: the voice can never run
 * past the next action. `finish()` lays them on the video at their steps.
 *
 * ELEVENLABS_API_KEY comes from .env. TUTORIAL_VOICE_ID picks another voice
 * (default Alice — clear, British, an educator's pace).
 */
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const VOICE_ID = process.env.TUTORIAL_VOICE_ID ?? 'Xb7hH8MSUJpSbSDYk0k2'
const MODEL_ID = 'eleven_multilingual_v2'
const SETTINGS = { similarity_boost: 0.75, stability: 0.5, style: 0, use_speaker_boost: true }

export type Clip = { duration: number; file: string }

/**
 * What a caption sounds like: symbols are read as words, and the arrows and
 * middots that set out the recap cards become pauses.
 */
export const spoken = (text: string) =>
  text
    .replace(/⋯/g, 'three-dot')
    .replace(/\s*[→·]\s*/g, ', ')
    .replace(/&/g, 'and')
    .replace(/\s+/g, ' ')
    .trim()

const key = (text: string) =>
  createHash('sha1').update(JSON.stringify([VOICE_ID, MODEL_ID, SETTINGS, spoken(text)])).digest('hex').slice(0, 16)

const apiKey = () => {
  if (!process.env.ELEVENLABS_API_KEY) {
    try {
      process.loadEnvFile(path.resolve(process.cwd(), '.env'))
    } catch {
      // no .env: reported below
    }
  }
  const k = process.env.ELEVENLABS_API_KEY
  if (!k) throw new Error('ELEVENLABS_API_KEY is not set (plumpose/.env)')
  return k
}

const duration = (file: string) => {
  const probe = spawnSync(
    'ffprobe',
    ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', file],
    { encoding: 'utf8' },
  )
  const seconds = Number(probe.stdout.trim())
  if (!seconds) throw new Error(`could not measure ${file}`)
  return seconds
}

export class Voice {
  readonly dir: string

  constructor(videoDir: string) {
    this.dir = path.join(videoDir, 'voice')
  }

  /** The clip for a line if it has been made, else null. */
  cached(text: string): Clip | null {
    const file = path.join(this.dir, `${key(text)}.mp3`)
    return fs.existsSync(file) ? { duration: duration(file), file } : null
  }

  /** The clip for a line, made now if it is not cached. */
  async clip(text: string): Promise<Clip> {
    const have = this.cached(text)
    if (have) return have
    fs.mkdirSync(this.dir, { recursive: true })
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128`, {
      body: JSON.stringify({ model_id: MODEL_ID, text: spoken(text), voice_settings: SETTINGS }),
      headers: { 'content-type': 'application/json', 'xi-api-key': apiKey() },
      method: 'POST',
    })
    if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${await res.text()}`)
    const file = path.join(this.dir, `${key(text)}.mp3`)
    fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()))
    return { duration: duration(file), file }
  }
}

/**
 * The narrated video: every clip placed at its time over the silent recording,
 * `lead` seconds after its caption appears (the caption fades in over 0.2 s).
 */
export const mixVoice = (video: string, clips: { at: number; file: string }[], out: string) => {
  if (!clips.length) return false
  const inputs = clips.flatMap((c) => ['-i', c.file])
  const delays = clips.map((c, i) => {
    const ms = Math.max(0, Math.round(c.at * 1000))
    return `[${i + 1}:a]adelay=${ms}|${ms}[a${i}]`
  })
  const mix = `${clips.map((_, i) => `[a${i}]`).join('')}amix=inputs=${clips.length}:normalize=0:dropout_transition=0,apad[voice]`
  const run = spawnSync(
    'ffmpeg',
    [
      '-y', '-loglevel', 'error', '-i', video, ...inputs,
      '-filter_complex', [...delays, mix].join(';'),
      '-map', '0:v', '-map', '[voice]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-shortest',
      '-movflags', '+faststart', out,
    ],
    { stdio: 'inherit' },
  )
  return run.status === 0
}
