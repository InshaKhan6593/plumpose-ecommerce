import type { GlobalAfterChangeHook } from 'payload'

/**
 * Keeps her FAQs in step with Site settings → Returns → Days to ask for a
 * return. When the number changes, every FAQ answer that says "within 14 days"
 * (the old number) says the new one — so she changes it once, not in three
 * places. Only "within <old> days" is touched: "14 business days" of delivery
 * and any other number are left alone. The answers stay ordinary text she can
 * edit; nothing in them is a placeholder.
 */
export const syncReturnDays: GlobalAfterChangeHook = async ({ doc, previousDoc, req }) => {
  const from = Number(previousDoc?.returnWindowDays)
  const to = Number(doc?.returnWindowDays)
  if (!from || !to || from === to) return doc

  const pattern = new RegExp(`\\bwithin ${from} days\\b`, 'gi')
  const faqs = await req.payload.find({
    collection: 'faqs',
    depth: 0,
    limit: 500,
    pagination: false,
    req,
  })

  for (const faq of faqs.docs) {
    const { changed, value } = replaceInText(faq.answer, pattern, `within ${to} days`)
    if (!changed) continue
    await req.payload.update({
      collection: 'faqs',
      data: { answer: value as typeof faq.answer },
      id: faq.id,
      req,
    })
  }
  return doc
}

/** Replaces inside every text node of a rich-text (Lexical) value, leaving its shape alone. */
export function replaceInText(
  node: unknown,
  pattern: RegExp,
  replacement: string,
): { changed: boolean; value: unknown } {
  let changed = false
  const walk = (n: unknown): unknown => {
    if (Array.isArray(n)) return n.map(walk)
    if (!n || typeof n !== 'object') return n
    const out: Record<string, unknown> = {}
    for (const [key, v] of Object.entries(n)) {
      if (key === 'text' && typeof v === 'string') {
        pattern.lastIndex = 0
        const next = v.replace(pattern, replacement)
        if (next !== v) changed = true
        out[key] = next
      } else out[key] = walk(v)
    }
    return out
  }
  const value = walk(node)
  return { changed, value }
}
