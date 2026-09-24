/**
 * The branded shell every plumpose email is poured into.
 *
 * Email clients are not browsers: Outlook ignores most CSS, Gmail strips
 * `<style>` in some views, and web fonts load almost nowhere but Apple Mail.
 * So this is tables and inline styles, with the brand carried by palette,
 * spacing and letterspacing rather than by typefaces — Fraunces and Jost are
 * requested, and Georgia / Helvetica are what most recipients will see.
 *
 * Everything a customer typed (names, address, gift note, lettering) goes
 * through `esc()`. A gift note of `<a href=…>` must arrive as text.
 */

export const palette = {
  ink: '#1b1815',
  inkFaint: '#a9a299',
  inkSoft: '#7a736a',
  line: '#dcd8d2',
  paper: '#ffffff',
  paper2: '#f6f4f0',
} as const

const displayFont = `'Fraunces', Georgia, 'Times New Roman', serif`
const bodyFont = `'Jost', 'Helvetica Neue', Helvetica, Arial, sans-serif`

export const esc = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

/** Letterspaced uppercase label — the admin's and the site's signature detail. */
export const label = (text: string): string =>
  `<div style="font-family:${bodyFont};font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${palette.inkSoft};margin:0 0 8px;">${esc(text)}</div>`

export const heading = (text: string): string =>
  `<h1 style="font-family:${displayFont};font-weight:300;font-size:30px;line-height:1.2;color:${palette.ink};margin:0 0 16px;">${esc(text)}</h1>`

export const paragraph = (html: string): string =>
  `<p style="font-family:${bodyFont};font-size:15px;line-height:1.65;color:${palette.ink};margin:0 0 16px;">${html}</p>`

export const muted = (html: string): string =>
  `<p style="font-family:${bodyFont};font-size:13px;line-height:1.6;color:${palette.inkSoft};margin:0 0 12px;">${html}</p>`

export const rule = (): string =>
  `<div style="border-top:1px solid ${palette.line};margin:28px 0;line-height:0;font-size:0;">&nbsp;</div>`

export const button = (href: string, text: string): string =>
  `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 8px;"><tr><td style="background:${palette.ink};">` +
  `<a href="${esc(href)}" style="display:inline-block;padding:14px 28px;font-family:${bodyFont};font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:${palette.paper};text-decoration:none;">${esc(text)}</a>` +
  `</td></tr></table>`

/** A two-column row: label left, value right. Used for the money breakdown. */
export const row = (left: string, right: string, opts: { strong?: boolean } = {}): string => {
  const weight = opts.strong ? '500' : '400'
  const size = opts.strong ? '16px' : '14px'
  return (
    `<tr>` +
    `<td style="font-family:${bodyFont};font-size:${size};font-weight:${weight};color:${palette.ink};padding:6px 0;">${left}</td>` +
    `<td align="right" style="font-family:${bodyFont};font-size:${size};font-weight:${weight};color:${palette.ink};padding:6px 0;white-space:nowrap;">${right}</td>` +
    `</tr>`
  )
}

export const table = (rows: string): string =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${rows}</table>`

export type Footer = {
  contactEmail?: null | string
  instagramHandle?: null | string
  instagramUrl?: null | string
  whatsappNumber?: null | string
}

const footerHtml = (footer: Footer): string => {
  const parts: string[] = []

  if (footer.contactEmail) {
    parts.push(
      `<a href="mailto:${esc(footer.contactEmail)}" style="color:${palette.inkSoft};">${esc(footer.contactEmail)}</a>`,
    )
  }

  if (footer.whatsappNumber) {
    const digits = footer.whatsappNumber.replace(/[^\d]/g, '')
    parts.push(
      `<a href="https://wa.me/${digits}" style="color:${palette.inkSoft};">WhatsApp ${esc(footer.whatsappNumber)}</a>`,
    )
  }

  if (footer.instagramHandle) {
    const href =
      footer.instagramUrl || `https://instagram.com/${footer.instagramHandle.replace(/^@/, '')}`
    parts.push(
      `<a href="${esc(href)}" style="color:${palette.inkSoft};">${esc(footer.instagramHandle)}</a>`,
    )
  }

  return parts.join(' &nbsp;·&nbsp; ')
}

/**
 * Wraps a body in the page: paper background, a white card, the wordmark, the
 * contact footer. `preheader` is the grey line inboxes show after the subject.
 */
export const layout = (args: { body: string; footer: Footer; preheader: string }): string => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<link href="https://fonts.googleapis.com/css2?family=Fraunces:wght@300;400&family=Jost:wght@400;500&display=swap" rel="stylesheet">
<title>plumpose</title>
</head>
<body style="margin:0;padding:0;background:${palette.paper2};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(args.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${palette.paper2};">
<tr><td align="center" style="padding:40px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">
<tr><td align="center" style="padding:0 0 28px;">
<div style="font-family:${displayFont};font-weight:300;font-size:28px;letter-spacing:0.08em;color:${palette.ink};">plumpose</div>
</td></tr>
<tr><td style="background:${palette.paper};padding:44px 40px;border:1px solid ${palette.line};">
${args.body}
</td></tr>
<tr><td align="center" style="padding:28px 16px 0;font-family:${bodyFont};font-size:12px;line-height:1.8;color:${palette.inkSoft};">
${footerHtml(args.footer)}
<div style="margin-top:10px;color:${palette.inkFaint};letter-spacing:0.12em;text-transform:uppercase;font-size:10px;">Hand-finished in Doha</div>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`
