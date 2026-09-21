import type { Currency } from '@payloadcms/plugin-ecommerce/types'

/**
 * plumpose settles in Qatari Riyal. The gateway (SkipCash) is Qatari and
 * charges in QAR; any other currency shown on the storefront is a display
 * conversion only, exactly as on the existing site.
 *
 * Prices are stored in minor units — QAR 1,399.00 is 139900.
 */
export const QAR: Currency = {
  code: 'QAR',
  decimals: 2,
  label: 'Qatari Riyal',
  symbol: 'QAR',
}
