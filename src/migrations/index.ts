import * as migration_20260925_165629_initial from './20260925_165629_initial';
import * as migration_20260927_184819_simplify_sizes_and_product_drafts from './20260927_184819_simplify_sizes_and_product_drafts';

export const migrations = [
  {
    up: migration_20260925_165629_initial.up,
    down: migration_20260925_165629_initial.down,
    name: '20260925_165629_initial',
  },
  {
    up: migration_20260927_184819_simplify_sizes_and_product_drafts.up,
    down: migration_20260927_184819_simplify_sizes_and_product_drafts.down,
    name: '20260927_184819_simplify_sizes_and_product_drafts'
  },
];
