/**
 * A web address from a title. Payload's own slugify turns each space into a
 * hyphen and then drops everything else, so "Al Shaheen Nights — Silk Pyjama
 * Set" became `al-shaheen-nights--silk-pyjama-set` and "Résumé" lost its
 * letters. This keeps accented letters (without the accent), reads "&" as
 * "and", and joins every run of anything else with a single hyphen.
 *
 * A plain module: the admin's web-address box previews it in the browser.
 */
export const webSlug = (text: string): string =>
  text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
