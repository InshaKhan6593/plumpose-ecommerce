/**
 * Plays a muted, inline film, and if the browser refuses (Safari on an iPad
 * or Mac in Low Power Mode blocks autoplay; the client saw a still frame
 * with Safari's play button over it, 28 Sep 2026), plays it on the visitor's
 * first tap, click or key press instead — a gesture Low Power Mode allows.
 * Until then the poster shows; Safari's own play button is hidden in
 * globals.css.
 *
 * Returns a cleanup that drops the waiting listeners.
 */
const GESTURES = ['pointerdown', 'touchend', 'keydown'] as const

export function playFilm(video: HTMLVideoElement): () => void {
  let waiting = false

  const stopWaiting = () => {
    if (!waiting) return
    waiting = false
    for (const type of GESTURES) window.removeEventListener(type, retry, true)
  }

  function retry() {
    stopWaiting()
    if (video.isConnected && !video.ended) video.play().catch(() => undefined)
  }

  video.play().catch((error: unknown) => {
    // Only a refusal is worth waiting out; an aborted play (paused, unmounted) is not.
    if ((error as { name?: string })?.name !== 'NotAllowedError' || waiting) return
    waiting = true
    for (const type of GESTURES) window.addEventListener(type, retry, { capture: true, passive: true })
  })

  return stopWaiting
}
