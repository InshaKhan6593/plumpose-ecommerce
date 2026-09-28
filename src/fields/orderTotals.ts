import type { Field } from 'payload'

import { neverEditable } from '@/access/isAdminOrStaff'

/**
 * The money breakdown behind an order's single `amount` (§6).
 *
 * The plugin records one total. That is enough to take a payment and not
 * nearly enough to run the business: when a customer asks why their order came
 * to QAR 1,719, somebody has to be able to say "1,399 for the piece, 160 for
 * the embroidery, 160 for delivery to Al Khor" — and when SkipCash is
 * reconciled at month end, the parts have to add up to what was charged.
 *
 * Every figure is **QAR in minor units**, the store's base currency, matching
 * `amount`. The display fields record what the customer actually saw in their
 * own currency, which is a conversion for reading only — the card is always
 * charged the QAR figure. That disclosure is C21 and it is why the legacy
 * checkout wrote "CHARGED AS QAR ____" beside every local price.
 *
 * All of it is written by the server at checkout and read-only thereafter, for
 * the same reason `amount` is: a hand-edited total silently breaks
 * reconciliation.
 */
const readOnlyMoney = (
  name: string,
  label: string,
  description: string,
  condition?: (data: Record<string, unknown>) => boolean,
): Field => ({
  name,
  type: 'number',
  access: { update: neverEditable },
  admin: {
    // Minor units: shown as QAR 1,399.00, not "139900".
    components: { Field: '@/components/admin/ReadOnlyMoneyField#ReadOnlyMoneyField' },
    ...(condition ? { condition } : {}),
    description,
    readOnly: true,
  },
  label,
})

/*
 * Boxes that are empty on most orders show only when they hold something:
 * every order carried an empty Discount, Discount code, Display currency and
 * Display total.
 */
const hasValue = (name: string) => (data: Record<string, unknown>) =>
  data?.[name] !== undefined && data?.[name] !== null && data?.[name] !== '' && data?.[name] !== 0

export const orderTotalsFields: Field[] = [
  readOnlyMoney(
    'subtotalQar',
    'Pieces',
    'The garments alone, before embroidery, delivery or any discount.',
  ),
  readOnlyMoney(
    'personalisationTotalQar',
    'Embroidery',
    'Every personalisation placement across every line.',
  ),
  readOnlyMoney('shippingQar', 'Delivery', 'Charged delivery. Zero when free shipping applied.'),
  readOnlyMoney('discountTotalQar', 'Discount', 'What the discount code took off.', hasValue('discountTotalQar')),
  {
    name: 'shippingLabel',
    type: 'text',
    access: { update: neverEditable },
    admin: {
      description: 'How delivery was described to the customer, e.g. "Delivery to Al Khor".',
      readOnly: true,
    },
    label: 'Delivery description',
  },
  {
    name: 'shippingZone',
    type: 'text',
    access: { update: neverEditable },
    admin: { description: 'Which rate was applied — the audit trail for the fee.', readOnly: true },
    label: 'Delivery zone',
  },
  {
    name: 'discountCode',
    type: 'text',
    access: { update: neverEditable },
    admin: { condition: hasValue('discountCode'), description: 'The code as the customer typed it.', readOnly: true },
  },
  {
    name: 'freeShippingApplied',
    type: 'checkbox',
    access: { update: neverEditable },
    admin: {
      condition: (data) => data?.freeShippingApplied === true,
      description: 'Delivery was waived by the spend threshold rather than by a code.',
      readOnly: true,
    },
    defaultValue: false,
  },
  {
    name: 'displayCurrency',
    type: 'text',
    access: { update: neverEditable },
    admin: {
      condition: hasValue('displayCurrency'),
      description: 'The currency the customer was shopping in. Settlement is always QAR.',
      readOnly: true,
    },
  },
  {
    name: 'displayTotal',
    type: 'text',
    access: { update: neverEditable },
    admin: {
      condition: hasValue('displayTotal'),
      description:
        'The total as it read on their screen, e.g. "£355". Kept so the receipt and the order email match the page they paid from.',
      readOnly: true,
    },
  },
]
