/**
 * Homepage copy.
 *
 * ⚠️ PLACEHOLDERS, from the approved mockups (docs/SCREEN-PROMPTS.md) — not
 * the client's words yet:
 *   - the tagline: eleven candidates in the brand guideline, none chosen
 *   - the print story
 * Replace before launch. Next step is to move these into an admin-editable
 * Homepage global so she can change them herself (REQUIREMENTS S1).
 */
export const HOME = {
  hero: {
    cta: 'Discover the collection',
    /** The opening of her own product description — her words, not a placeholder. */
    intro: 'Inspired by the tranquil waters of Qatar and the seasonal gathering of whale sharks.',
    tagline: ['Rest', 'differently.'],
  },
  /**
   * Her own words — the opening of the product description — set in mixed
   * upright and italic, as the reference sets its philosophy line.
   */
  philosophy: {
    headline: [
      { text: 'Inspired by the ' },
      { italic: true, text: 'tranquil waters' },
      { text: ' of Qatar and the ' },
      { italic: true, text: 'seasonal gathering' },
      { text: ' of whale sharks.' },
    ] as ReadonlyArray<{ italic?: boolean; text: string }>,
    label: 'Resort 2026',
  },
  /** The pinned "how it is made" sequence. The facts in each step come from the database. */
  steps: {
    heading: ['Made for you,', 'by hand'],
    label: 'From our atelier to you',
  },
  print: {
    body: 'The whale shark returns to our coast every summer. We drew it by hand, star by star.',
    cta: 'Read the story',
    heading: ['Drawn from the', 'waters of Qatar'],
    label: 'The print',
  },
} as const

/**
 * The photographs each section uses, by filename in the Media library
 * (seeded from brand-assets/product/ — see src/seed/index.ts).
 */
export const HOME_MEDIA = {
  armchair: 'brand-05-armchair.jpg',
  corridor: 'brand-04-corridor.jpg',
  piping: 'brand-03-piping.jpg',
  print: 'brand-02-print-macro.jpg',
  qatarBook: 'brand-07-qatar-book.jpg',
  window: 'brand-01-window.jpg',
} as const

export type HomeMediaKey = keyof typeof HOME_MEDIA

/**
 * AI-generated **test** photographs (docs/TEST-SHOTS.md), imported with
 * `pnpm test-shots`. Used only while the server runs with `TEST_SHOTS=on`,
 * and only where a test shot exists — never for launch.
 */
export const TEST_MEDIA: Partial<Record<HomeMediaKey, string>> = {
  print: 'test-print-wide.jpg',
}
