import * as migration_20260925_165629_initial from './20260925_165629_initial';
import * as migration_20260927_184819_simplify_sizes_and_product_drafts from './20260927_184819_simplify_sizes_and_product_drafts';
import * as migration_20260927_205742_free_embroidery_prize from './20260927_205742_free_embroidery_prize';
import * as migration_20260927_205800_her_prizes_and_care_text from './20260927_205800_her_prizes_and_care_text';
import * as migration_20260927_214513_price_box_starts_ticked from './20260927_214513_price_box_starts_ticked';
import * as migration_20260928_130315_return_window_days from './20260928_130315_return_window_days';
import * as migration_20260928_135124_shipping_text_editable from './20260928_135124_shipping_text_editable';
import * as migration_20260928_140809_order_reference from './20260928_140809_order_reference';

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
    name: '20260928_140809_order_reference'
  },
];
