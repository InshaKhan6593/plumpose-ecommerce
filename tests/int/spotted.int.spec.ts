import sharp from 'sharp'
import { describe, expect, it } from 'vitest'

import { checkSubmission, MAX_BYTES } from '@/endpoints/spottedSubmit'

/**
 * Spotted submissions (REQUIREMENTS S15): what the endpoint accepts, with real
 * image bytes. The endpoint itself — upload, pending, approval, deletion on
 * rejection — is exercised over HTTP in the storefront check.
 */

const photo = (width: number, height: number, format: 'jpeg' | 'png' | 'webp' = 'jpeg') =>
  sharp({ create: { background: '#1f2b4d', channels: 3, height, width } })
    [format]()
    .toBuffer()

const good = { consent: true, handle: 'mariam.k' }

describe('spotted — what is accepted', () => {
  it('takes a real photograph with a handle and permission', async () => {
    const data = await photo(1080, 1350)
    const result = await checkSubmission({
      data: {
        ...good,
        caption: '  Morning in Doha ',
        postUrl: 'https://www.instagram.com/p/abc123/',
      },
      file: { data, mimetype: 'image/jpeg', size: data.length },
    })
    expect(result.errors).toEqual({})
    expect(result.value).toEqual({
      caption: 'Morning in Doha',
      email: '',
      format: 'jpg',
      handle: '@mariam.k',
      postUrl: 'https://www.instagram.com/p/abc123/',
    })
  })

  it('reads the format from the bytes, not the name — PNG and WebP too', async () => {
    for (const format of ['png', 'webp'] as const) {
      const data = await photo(900, 900, format)
      // Claimed to be a JPEG; the bytes decide.
      const result = await checkSubmission({
        data: good,
        file: { data, mimetype: 'image/jpeg', size: data.length },
      })
      expect(result.value?.format).toBe(format)
    }
  })

  it('refuses something that is not an image, even named .jpg', async () => {
    const data = Buffer.from('<script>alert(1)</script>')
    expect(
      (
        await checkSubmission({
          data: good,
          file: { data, mimetype: 'image/jpeg', size: data.length },
        })
      ).errors,
    ).toEqual({ file: 'Please send a JPEG, PNG or WebP photograph.' })
  })

  it('refuses a photograph too small to show, or too large to send', async () => {
    const small = await photo(400, 500)
    expect(
      (
        await checkSubmission({
          data: good,
          file: { data: small, mimetype: 'image/jpeg', size: small.length },
        })
      ).errors.file,
    ).toMatch(/too small/)
    const any = await photo(900, 900)
    expect(
      (
        await checkSubmission({
          data: good,
          file: { data: any, mimetype: 'image/jpeg', size: MAX_BYTES + 1 },
        })
      ).errors.file,
    ).toMatch(/over 12 MB/)
  })

  it('needs a handle, permission, and a real Instagram link if one is given', async () => {
    const data = await photo(900, 900)
    const result = await checkSubmission({
      data: {
        consent: false,
        email: 'nope',
        handle: 'has spaces!',
        postUrl: 'https://evil.example/p/1',
      },
      file: { data, mimetype: 'image/jpeg', size: data.length },
    })
    expect(result.errors).toEqual({
      consent: 'Please confirm we may share your photograph.',
      email: 'Please check the email address.',
      handle: 'Please add your Instagram name, like @yourname.',
      postUrl: 'That should be a link to the post on Instagram.',
    })
  })

  it('asks for a photograph when none is sent', async () => {
    expect((await checkSubmission({ data: good })).errors).toEqual({
      file: 'Please choose a photograph.',
    })
  })
})
