/**
 * An enquiry as she reads it in the list (REQUIREMENTS A16): who it is from,
 * what it is about, and the start of the message — pulled out of the form
 * plugin's name/value rows, which the list would otherwise show as "[object]".
 */
type Row = { field?: null | string; value?: null | string }

const valueOf = (rows: Row[] | null | undefined, name: string) => (rows ?? []).find((r) => r.field === name)?.value?.trim() ?? ''

export function enquirySummary(rows: Row[] | null | undefined): { about: string; from: string; preview: string } {
  const name = valueOf(rows, 'name')
  const email = valueOf(rows, 'email')
  const subject = valueOf(rows, 'subject')
  const order = valueOf(rows, 'orderNumber')
  const message = valueOf(rows, 'message').replace(/\s+/g, ' ')
  return {
    about: [subject, order ? `order ${order.startsWith('#') ? order : `#${order}`}` : ''].filter(Boolean).join(' · ') || '—',
    from: [name, email && `<${email}>`].filter(Boolean).join(' ') || '—',
    preview: message.length > 90 ? `${message.slice(0, 89).trimEnd()}…` : message,
  }
}
