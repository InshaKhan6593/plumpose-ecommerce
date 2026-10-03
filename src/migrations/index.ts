import * as migration_20260925_165629_initial from './20260925_165629_initial';
import * as migration_20260927_184819_simplify_sizes_and_product_drafts from './20260927_184819_simplify_sizes_and_product_drafts';
import * as migration_20260927_205742_free_embroidery_prize from './20260927_205742_free_embroidery_prize';
import * as migration_20260927_205800_her_prizes_and_care_text from './20260927_205800_her_prizes_and_care_text';
import * as migration_20260927_214513_price_box_starts_ticked from './20260927_214513_price_box_starts_ticked';
import * as migration_20260928_130315_return_window_days from './20260928_130315_return_window_days';
import * as migration_20260928_135124_shipping_text_editable from './20260928_135124_shipping_text_editable';
import * as migration_20260928_140809_order_reference from './20260928_140809_order_reference';
import * as migration_20260928_151157_orders_open from './20260928_151157_orders_open';
import * as migration_20260928_151659_order_cancel_refund from './20260928_151659_order_cancel_refund';
import * as migration_20260928_151900_ready_to_ship_wording from './20260928_151900_ready_to_ship_wording';
import * as migration_20260929_090000_size_offered from './20260929_090000_size_offered';
import * as migration_20260930_194111_qbas_courier from './20260930_194111_qbas_courier';
import * as migration_20260930_222330_shipping_zone_fees from './20260930_222330_shipping_zone_fees';
import * as migration_20261003_113258_courier_driver_proof from './20261003_113258_courier_driver_proof';

export const migrations = [
  {
    up: migration_20260925_165629_initial.up,
    down: migration_20260925_165629_initial.down,
    name: '20260925_165629_initial',
  },
  {
    up: migration_20260927_184819_simplify_sizes_and_product_drafts.up,
    down: migration_20260927_184819_simplify_sizes_and_product_drafts.down,
    name: '20260927_184819_simplify_sizes_and_product_drafts',
  },
  {
    up: migration_20260927_205742_free_embroidery_prize.up,
    down: migration_20260927_205742_free_embroidery_prize.down,
    name: '20260927_205742_free_embroidery_prize',
  },
  {
    up: migration_20260927_205800_her_prizes_and_care_text.up,
    down: migration_20260927_205800_her_prizes_and_care_text.down,
    name: '20260927_205800_her_prizes_and_care_text',
  },
  {
    up: migration_20260927_214513_price_box_starts_ticked.up,
    down: migration_20260927_214513_price_box_starts_ticked.down,
    name: '20260927_214513_price_box_starts_ticked',
  },
  {
    up: migration_20260928_130315_return_window_days.up,
    down: migration_20260928_130315_return_window_days.down,
    name: '20260928_130315_return_window_days',
  },
  {
    up: migration_20260928_135124_shipping_text_editable.up,
    down: migration_20260928_135124_shipping_text_editable.down,
    name: '20260928_135124_shipping_text_editable',
  },
  {
    up: migration_20260928_140809_order_reference.up,
    down: migration_20260928_140809_order_reference.down,
    name: '20260928_140809_order_reference',
  },
  {
    up: migration_20260928_151157_orders_open.up,
    down: migration_20260928_151157_orders_open.down,
    name: '20260928_151157_orders_open',
  },
  {
    up: migration_20260928_151659_order_cancel_refund.up,
    down: migration_20260928_151659_order_cancel_refund.down,
    name: '20260928_151659_order_cancel_refund',
  },
  {
    up: migration_20260928_151900_ready_to_ship_wording.up,
    down: migration_20260928_151900_ready_to_ship_wording.down,
    name: '20260928_151900_ready_to_ship_wording',
  },
  {
    up: migration_20260929_090000_size_offered.up,
    down: migration_20260929_090000_size_offered.down,
    name: '20260929_090000_size_offered',
  },
  {
    up: migration_20260930_194111_qbas_courier.up,
    down: migration_20260930_194111_qbas_courier.down,
    name: '20260930_194111_qbas_courier',
  },
  {
    up: migration_20260930_222330_shipping_zone_fees.up,
    down: migration_20260930_222330_shipping_zone_fees.down,
    name: '20260930_222330_shipping_zone_fees',
  },
  {
    up: migration_20261003_113258_courier_driver_proof.up,
    down: migration_20261003_113258_courier_driver_proof.down,
    name: '20261003_113258_courier_driver_proof'
  },
];
