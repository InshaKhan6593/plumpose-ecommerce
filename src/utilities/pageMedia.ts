import type { Payload } from 'payload'

import type { Media } from '@/payload-types'

import { PAGE_MEDIA, PAGE_TEST_MEDIA, type PageMediaKey, type PageTestKey } from '@/content/pages'

/**
 * Loads the content pages' photographs in one query and returns a picker.
 *
 *   const pick = await loadPageMedia(payload)
 *   pick('doorway')              // the real photograph
 *   pick('doorway', 'founder')   // the founder test shot while TEST_SHOTS=on, else the real one
 *   pick('piping', 'embroidery', 'atelier')   // the first test shot that exists, else the real one
 *   pick.only('sea')             // a test shot with no real photograph behind it, or nothing
 *
 * Test shots (docs/TEST-SHOTS.md) are only ever used while the server runs
 * with `TEST_SHOTS=on`, and only where one has been imported — so a missing
 * test shot falls back quietly, and production always shows the real set.
 */
export async function loadPageMedia(payload: Payload) {
  const testing = process.env.TEST_SHOTS === 'on'
  const filenames = [
    ...Object.values(PAGE_MEDIA),
    ...(testing ? Object.values(PAGE_TEST_MEDIA) : []),
  ]

  const { docs } = await payload.find({
    collection: 'media',
    depth: 0,
    limit: filenames.length,
    pagination: false,
    where: { filename: { in: filenames } },
  })
  const byFile = new Map(docs.map((doc) => [doc.filename, doc as Media]))

  const pick = (key: PageMediaKey, ...tests: PageTestKey[]): Media | undefined => {
    if (testing) {
      for (const test of tests) {
        const shot = byFile.get(PAGE_TEST_MEDIA[test])
        if (shot) return shot
      }
    }
    return byFile.get(PAGE_MEDIA[key])
  }

  /**
   * A test shot with no real photograph behind it — for a section that exists
   * only while there is a picture for it (e.g. the sea band on Our Story).
   * Always undefined in production.
   */
  const only = (test: PageTestKey): Media | undefined =>
    testing ? byFile.get(PAGE_TEST_MEDIA[test]) : undefined

  return Object.assign(pick, { only })
}
