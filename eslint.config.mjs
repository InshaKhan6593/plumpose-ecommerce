import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'

/*
 * eslint-config-next 16 ships flat configs. Loading them through FlatCompat's
 * legacy `extends` (as the template did) crashed ESLint before it read a file:
 * "Converting circular structure to JSON" on the react plugin object.
 */
const eslintConfig = [
  ...nextVitals,
  ...nextTypescript,
  {
    rules: {
      /*
       * React Compiler readiness checks, new in react-hooks 7. This app does not
       * use the compiler, and what they flag is the ordinary pattern of reading
       * the browser (storage, media queries, the session) in an effect. Kept
       * visible as warnings rather than rewriting working, tested components.
       */
      'react-hooks/purity': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      '@typescript-eslint/ban-ts-comment': 'warn',
      '@typescript-eslint/no-empty-object-type': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          args: 'after-used',
          ignoreRestSiblings: false,
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^(_|ignore)',
        },
      ],
    },
  },
  {
    ignores: [
      '.next/',
      '.next-*/',
      'playwright-report/',
      'test-results/',
      'src/payload-types.ts',
      'src/payload-generated-schema.ts',
      'src/app/(payload)/admin/importMap.js',
      // Written by `payload migrate:create`, with its own @ts-nocheck.
      'src/migrations/',
    ],
  },
]

export default eslintConfig
