import type { CollectionConfig, FieldHook } from 'payload'

import { adminOnly } from '@/access/adminOnly'
import { refreshRatesCronEndpoint, refreshRatesEndpoint } from '@/endpoints/refreshRates'
import { formatDifference, rateCheck } from '@/lib/pricing/rates'

/** The anchor piece's QAR price (Site settings → Currencies), read once per request. */
const anchorOf = async (req: Parameters<FieldHook>[0]['req']): Promise<number> => {
  const ctx = req.context as { anchorQar?: number }
  if (ctx.anchorQar) return ctx.anchorQar
  const settings = await req.payload.findGlobal({ depth: 0, req, slug: 'siteSettings' }).catch(() => null)
  ctx.anchorQar = settings?.currencyAnchorQar && settings.currencyAnchorQar > 0 ? settings.currencyAnchorQar : 1399
  return ctx.anchorQar
}

const atTodaysRate: FieldHook = async ({ req, siblingData }) => {
  const check = rateCheck({ anchorQar: await anchorOf(req), price: siblingData?.priceOverride, rate: siblingData?.rate })
  if (!check) return null
  const decimals = typeof siblingData?.decimals === 'number' ? siblingData.decimals : 0
  return check.atRate.toLocaleString('en-GB', { maximumFractionDigits: decimals, minimumFractionDigits: decimals })
}

const difference: FieldHook = async ({ req, siblingData }) => {
  if (!siblingData?.priceOverride) return null
  const check = rateCheck({ anchorQar: await anchorOf(req), price: siblingData.priceOverride, rate: siblingData.rate })
  return check ? formatDifference(check.difference) : null
}

/**
 * Display currencies. Ported from netlify/lib/pricing.mjs.
 *
 * IMPORTANT: these are for display only. The card is always charged in QAR,
 * because SkipCash is a Qatari gateway and settles in riyals. Every price
 * shown in another currency is a guide, and the storefront says so.
 *
 * `priceOverride` is the hand-set retail price for that market — the old site
 * called these "set by hand" rows. Where it is empty the price is derived from
 * `rate` instead.
 */
export const Currencies: CollectionConfig = {
  slug: 'currencies',
  defaultSort: 'code',
  labels: { singular: 'Currency', plural: 'Currencies' },
  admin: {
    components: { beforeListTable: ['@/components/admin/RefreshRatesButton#RefreshRatesButton'] },
    defaultColumns: ['code', 'name', 'priceOverride', 'atTodaysRate', 'difference', 'rateUpdatedAt'],
    description:
      'Display prices only — every card is charged in QAR. Set a price by hand for the markets that matter.',
    group: 'Shop settings',
    listSearchableFields: ['code', 'name'],
    useAsTitle: 'code',
  },
  // The button above the list, and the daily scheduled job (REQUIREMENTS A14).
  endpoints: [refreshRatesEndpoint, refreshRatesCronEndpoint],
  access: {
    create: adminOnly,
    delete: adminOnly,
    read: () => true,
    update: adminOnly,
  },
  fields: [
    {
      name: 'code',
      type: 'text',
      index: true,
      maxLength: 3,
      required: true,
      unique: true,
    },
    { name: 'name', type: 'text', required: true },
    { name: 'symbol', type: 'text', required: true },
    {
      name: 'decimals',
      type: 'number',
      admin: { description: 'Decimal places shown.' },
      defaultValue: 0,
      min: 0,
    },
    {
      name: 'step',
      type: 'number',
      admin: { description: 'Round displayed delivery to the nearest this many units.' },
      defaultValue: 1,
      min: 1,
    },
    {
      name: 'priceOverride',
      type: 'number',
      admin: {
        description:
          'What Al Shaheen Nights (QAR 1,399 — Site settings → Currencies) costs in this currency, set by hand. Shown exactly; other amounts convert at the rate it implies. Leave empty to use the rate.',
      },
      label: 'Price set by hand',
      min: 0,
    },
    {
      name: 'rate',
      type: 'number',
      admin: { description: 'Units of this currency per 1 QAR.' },
      min: 0,
    },
    {
      name: 'rateUpdatedAt',
      type: 'date',
      admin: { date: { pickerAppearance: 'dayAndTime' }, position: 'sidebar', readOnly: true },
      label: 'Rate updated',
    },
    {
      name: 'atTodaysRate',
      type: 'text',
      admin: { description: 'What the anchor piece costs at the rate above — a check on the price set by hand.', readOnly: true },
      hooks: { afterRead: [atTodaysRate] },
      label: 'At today’s rate',
      virtual: true,
    },
    {
      name: 'difference',
      type: 'text',
      admin: { description: 'How far the price set by hand is from today’s rate (+ means above it).', readOnly: true },
      hooks: { afterRead: [difference] },
      label: 'Difference',
      virtual: true,
    },
  ],
}
