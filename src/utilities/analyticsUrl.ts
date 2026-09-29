/**
 * The address Google Analytics is told about, with private parts removed.
 *
 * Several pages carry a secret in the query: an order's `token` (the only key
 * to its page — see `app/(app)/order/[id]`), a password reset `token`, the
 * SkipCash payment `id` on `/checkout/return`. None of it may reach Google, so
 * only campaign parameters are kept — the ones Analytics reads to say where a
 * visitor came from (an Instagram link tagged `utm_source=instagram`, a Google
 * ad's `gclid`). Everything else in the query, and the fragment, is dropped.
 *
 * A plain module, not a client one, so the tests can import it.
 */
const KEEP = /^(utm_[a-z]+|gclid|gbraid|wbraid|fbclid)$/

export function analyticsUrl(href: string): string {
  let url: URL
  try {
    url = new URL(href)
  } catch {
    return ''
  }

  const kept = new URLSearchParams()
  url.searchParams.forEach((value, key) => {
    if (KEEP.test(key)) kept.append(key, value)
  })

  const query = kept.toString()
  return `${url.origin}${url.pathname}${query ? `?${query}` : ''}`
}
