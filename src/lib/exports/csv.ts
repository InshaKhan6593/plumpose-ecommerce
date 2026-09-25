/**
 * Spreadsheets she can open in Excel or Numbers (REQUIREMENTS A6, S19, A17).
 *
 *   - UTF-8 with a byte-order mark, so Excel shows Arabic names and "—"
 *     correctly instead of mojibake;
 *   - every cell quoted when it holds a comma, quote or line break;
 *   - **formula injection** blocked: a customer can type `=HYPERLINK(...)`
 *     into a name or a gift note, and a spreadsheet would run it when she
 *     opens the file. Any cell starting with = + - @ (or a tab / carriage
 *     return) is prefixed with an apostrophe, which spreadsheets show as text.
 *     Plain negative numbers are left as numbers.
 */

export type Cell = boolean | null | number | string | undefined

const FORMULA = /^[=+\-@\t\r]/
const NUMBER = /^-?\d+(\.\d+)?$/

export const csvCell = (value: Cell): string => {
  if (value === null || value === undefined) return ''
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  let text = String(value)
  if (typeof value !== 'number' && FORMULA.test(text) && !NUMBER.test(text)) text = `'${text}`
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/** A whole file: the header row, then the rows, CRLF line ends as Excel expects. */
export const toCsv = (header: string[], rows: Cell[][]): string =>
  '\uFEFF' + [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n'

/** A QAR amount in minor units as a plain number of riyals, for a spreadsheet column. */
export const riyals = (minor: null | number | undefined): number => Math.round(minor ?? 0) / 100

/** A date as Doha sees it, e.g. "2026-09-25 14:05" — sortable in a spreadsheet. */
export const dohaTime = (iso: null | string | undefined): string => {
  if (!iso) return ''
  const parts = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
    minute: '2-digit',
    month: '2-digit',
    timeZone: 'Asia/Qatar',
    year: 'numeric',
  }).formatToParts(new Date(iso))
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`
}

/** "plumpose-orders-2026-09-25.csv" */
export const exportFilename = (what: string, now = new Date()) =>
  `plumpose-${what}-${dohaTime(now.toISOString()).slice(0, 10)}.csv`
