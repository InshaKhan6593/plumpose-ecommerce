/** The words of a rich-text (Lexical) value, for structured data and meta descriptions. */
export function plainText(value: unknown): string {
  const out: string[] = []
  const walk = (node: unknown) => {
    if (!node || typeof node !== 'object') return
    const n = node as { children?: unknown[]; root?: unknown; text?: string; type?: string }
    if (typeof n.text === 'string') out.push(n.text)
    if (n.root) walk(n.root)
    n.children?.forEach(walk)
    if (n.type === 'paragraph') out.push(' ')
  }
  walk(value)
  return out.join('').replace(/\s+/g, ' ').trim()
}

/** Shortened at a word boundary to at most `max` characters, with an ellipsis when cut. */
export function clip(text: string, max = 160): string {
  if (text.length <= max) return text
  const cut = text.slice(0, max - 1)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.—-]+$/, '')}…`
}
