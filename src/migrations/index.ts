import * as migration_20260925_165629_initial from './20260925_165629_initial';

export const migrations = [
  {
    up: migration_20260925_165629_initial.up,
    down: migration_20260925_165629_initial.down,
    name: '20260925_165629_initial'
  },
];
