/**
 * Checks the R2 bucket is reachable with the keys in `.env`: writes a small
 * file, reads it back, lists it and deletes it. Leaves nothing behind.
 *
 *   npx tsx scripts/check-r2.ts
 */
import 'dotenv/config'

import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'

const { R2_ACCESS_KEY_ID, R2_ACCOUNT_ID, R2_BUCKET, R2_SECRET_ACCESS_KEY } = process.env
if (!R2_ACCOUNT_ID || !R2_BUCKET || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
  console.error(
    'Missing R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID or R2_SECRET_ACCESS_KEY in .env',
  )
  process.exit(1)
}

const s3 = new S3Client({
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  region: 'auto',
})

const key = `_check/${Date.now()}.txt`
const body = `plumpose R2 check ${new Date().toISOString()}`

const step = async (name: string, run: () => Promise<unknown>) => {
  try {
    const out = await run()
    console.log(`ok   ${name}${typeof out === 'string' ? ` — ${out}` : ''}`)
  } catch (error) {
    const e = error as { $metadata?: { httpStatusCode?: number }; message?: string; name?: string }
    console.log(
      `FAIL ${name} — ${e.name}: ${e.message} (HTTP ${e.$metadata?.httpStatusCode ?? '?'})`,
    )
    process.exitCode = 1
  }
}

await step('write', () =>
  s3.send(
    new PutObjectCommand({ Body: body, Bucket: R2_BUCKET, ContentType: 'text/plain', Key: key }),
  ),
)
await step('read', async () => {
  const got = await s3.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }))
  const text = await got.Body?.transformToString()
  if (text !== body) throw new Error('read back something different')
  return 'content matches'
})
await step('list', async () => {
  const listed = await s3.send(new ListObjectsV2Command({ Bucket: R2_BUCKET, Prefix: '_check/' }))
  return `${listed.KeyCount ?? 0} test file(s) seen`
})
await step('delete', () => s3.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key })))
await step('public access is off', async () => {
  const res = await fetch(`https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}/${key}`)
  if (res.ok) throw new Error('the bucket answered an unsigned request')
  return `unsigned request refused (HTTP ${res.status})`
})
