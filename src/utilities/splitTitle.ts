/**
 * "Al Shaheen Nights — Silk Pyjama Set" → name and subtitle, as the mockups
 * set them: the name in the display serif, the garment in italics beneath.
 *
 * A plain module so both server and client components can call it.
 */
export const splitTitle = (title: string): { name: string; subtitle: null | string } => {
  const [name, ...rest] = title.split(/\s+[—–]\s+/)
  return { name: name.trim(), subtitle: rest.length ? rest.join(' — ').trim() : null }
}
