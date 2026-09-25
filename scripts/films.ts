/**
 * The films (`public/video`) are the client's unreleased footage, so they are
 * not in the public repository. They live in the R2 bucket under `video/`,
 * and are copied into `public/video` before each build, so the host serves
 * them from its CDN like any other static file.
 *
 *   npx tsx scripts/films.ts upload   # this machine → R2, after re-encoding (scripts/encode-videos.sh)
 *   npx tsx scripts/films.ts fetch    # R2 → public/video, in the host's build command
 *
 * Both skip a file that is already there at the same size. Needs the four
 * R2_* variables.
 */
import 'dotenv/config'

import {
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import fs from 'node:fs'
import path from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'

import { r2ClientConfig, r2Config, VIDEO_PREFIX } from '../src/storage/r2'

const dirname = path.dirname(fileURLToPath(import.meta.url))
/** FILMS_DIR only to try a fetch somewhere else. */
const DIR = process.env.FILMS_DIR || path.resolve(dirname, '../public/video')

const TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
}

const config = r2Config()
if (!config) {
  console.error('Missing R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID or R2_SECRET_ACCESS_KEY.')
  process.exit(1)
}
const s3 = new S3Client(r2ClientConfig(config))
const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`

const listRemote = async (): Promise<Map<string, number>> => {
  const remote = new Map<string, number>()
  let token: string | undefined
  do {
    const page = await s3.send(
      new ListObjectsV2Command({
        Bucket: config.bucket,
        ContinuationToken: token,
        Prefix: `${VIDEO_PREFIX}/`,
      }),
    )
    for (const item of page.Contents ?? []) {
      if (item.Key) remote.set(item.Key.slice(VIDEO_PREFIX.length + 1), item.Size ?? 0)
    }
    token = page.NextContinuationToken
  } while (token)
  return remote
}

const upload = async () => {
  const remote = await listRemote()
  const files = fs.readdirSync(DIR).filter((name) => TYPES[path.extname(name)])
  for (const name of files) {
    const size = fs.statSync(path.join(DIR, name)).size
    if (remote.get(name) === size) {
      console.log(`same   ${name}`)
      continue
    }
    await s3.send(
      new PutObjectCommand({
        Body: fs.readFileSync(path.join(DIR, name)),
        Bucket: config.bucket,
        CacheControl: 'public, max-age=31536000, immutable',
        ContentType: TYPES[path.extname(name)],
        Key: `${VIDEO_PREFIX}/${name}`,
      }),
    )
    console.log(`upload ${name} (${mb(size)})`)
  }
}

const fetchAll = async () => {
  const remote = await listRemote()
  if (!remote.size) {
    console.error(
      `No films under ${VIDEO_PREFIX}/ in ${config.bucket}. Run "films.ts upload" first.`,
    )
    process.exit(1)
  }
  fs.mkdirSync(DIR, { recursive: true })
  for (const [name, size] of remote) {
    const target = path.join(DIR, name)
    if (fs.existsSync(target) && fs.statSync(target).size === size) {
      console.log(`same   ${name}`)
      continue
    }
    const got = await s3.send(
      new GetObjectCommand({ Bucket: config.bucket, Key: `${VIDEO_PREFIX}/${name}` }),
    )
    await pipeline(got.Body as Readable, fs.createWriteStream(target))
    console.log(`fetch  ${name} (${mb(size)})`)
  }
}

const command = process.argv[2]
if (command === 'upload') await upload()
else if (command === 'fetch') await fetchAll()
else {
  console.error('Usage: npx tsx scripts/films.ts upload | fetch')
  process.exit(1)
}
