/**
 * Records that exist only to show a full shop — the demo catalogue
 * (`pnpm demo:seed`, BUILD-LOG §24) and the sample Made for You projects —
 * carry these web-address prefixes. They are kept out of the sitemap and out
 * of search results, so a catalogue left loaded can never be indexed as hers.
 */
const PLACEHOLDER_PREFIXES = ['demo-', 'sample-']

export const isPlaceholderSlug = (slug: string | null | undefined): boolean =>
  Boolean(slug) && PLACEHOLDER_PREFIXES.some((prefix) => slug!.startsWith(prefix))
