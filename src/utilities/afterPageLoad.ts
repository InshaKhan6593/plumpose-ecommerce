/**
 * Runs `callback` once the page has finished loading and the browser has a
 * quiet moment — for films, which would otherwise start downloading as the
 * page hydrates and compete with its first photographs for the connection.
 * (The desktop hero is 7 MB; on localhost that is instant, on a hotel Wi-Fi it
 * is the photographs arriving late.) The poster stands in until then.
 *
 * After a client-side navigation the document has long since loaded, so it
 * runs on the next idle moment.
 */
export function afterPageLoad(callback: () => void): () => void {
  let cancelled = false
  let idleId: number | undefined
  let timeoutId: number | undefined

  const schedule = () => {
    if (cancelled) return
    const run = () => {
      if (!cancelled) callback()
    }
    if ('requestIdleCallback' in window) idleId = window.requestIdleCallback(run, { timeout: 1500 })
    else timeoutId = globalThis.setTimeout(run, 200) as unknown as number
  }

  if (document.readyState === 'complete') schedule()
  else window.addEventListener('load', schedule, { once: true })

  return () => {
    cancelled = true
    window.removeEventListener('load', schedule)
    if (idleId !== undefined) window.cancelIdleCallback(idleId)
    if (timeoutId !== undefined) globalThis.clearTimeout(timeoutId)
  }
}
