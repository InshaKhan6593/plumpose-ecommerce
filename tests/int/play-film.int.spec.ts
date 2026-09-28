import { describe, expect, it, vi } from 'vitest'

import { playFilm } from '@/utilities/playFilm'

const refused = () => Object.assign(new Error('refused'), { name: 'NotAllowedError' })
const tick = () => new Promise((r) => setTimeout(r, 0))

/** A film whose play() Safari refuses `refusals` times (Low Power Mode), then allows. */
const film = (refusals: number) => {
  const video = document.createElement('video')
  document.body.append(video)
  let left = refusals
  const play = vi.fn(() => (left-- > 0 ? Promise.reject(refused()) : Promise.resolve()))
  Object.defineProperty(video, 'play', { value: play })
  return { play, video }
}

describe('films when Safari refuses autoplay', () => {
  it('plays at once when allowed, and stays visible', async () => {
    const { play, video } = film(0)
    playFilm(video)
    await tick()
    expect(play).toHaveBeenCalledTimes(1)
    expect(video.style.visibility).toBe('')
  })

  it('hides the refused film (the poster shows) and plays it on the first tap', async () => {
    const { play, video } = film(1)
    playFilm(video)
    await tick()
    expect(video.style.visibility).toBe('hidden')

    window.dispatchEvent(new Event('pointerdown'))
    await tick()
    expect(play).toHaveBeenCalledTimes(2)
    expect(video.style.visibility).toBe('')

    // Only once: later taps do not keep calling play.
    window.dispatchEvent(new Event('pointerdown'))
    expect(play).toHaveBeenCalledTimes(2)
  })

  it('stops waiting when the film leaves the screen', async () => {
    const { play, video } = film(1)
    const stop = playFilm(video)
    await tick()
    stop()
    window.dispatchEvent(new Event('pointerdown'))
    expect(play).toHaveBeenCalledTimes(1)
  })
})
