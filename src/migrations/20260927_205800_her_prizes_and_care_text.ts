import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Her notes of 28 Sep 2026, as data. Separate from 20260927_205742, which adds
 * `freeEmbroidery` to the enums: Postgres will not let a new enum value be
 * used in the transaction that adds it, and Payload runs each migration in
 * its own.
 *
 *  1. The reward wheel: "10% off" becomes "5% off", and "QAR 100 off" becomes
 *     "Free embroidery" (one placement — she can change the number in the
 *     admin). Each segment keeps its place, weight and colour. Matched on the
 *     seeded label, type and value together, so a segment she has since edited
 *     herself is left alone. Codes already won stay as they were.
 *  2. The old Material & care text she struck out ("To preserve the beauty of
 *     this piece… dry cleaning… 30°C…") is cleared from the product and from
 *     its latest version — the one the admin opens, so a later save cannot
 *     bring it back. Older versions keep it, as history. The product page now
 *     shows her new care line (FABRIC in src/content/pages.ts).
 */
export async function up({ db, payload }: MigrateUpArgs): Promise<void> {
  const five = await db.execute(sql`
    UPDATE "spin_segments"
    SET "label" = '5% off', "reward_value" = 5, "updated_at" = now()
    WHERE "label" = '10% off' AND "reward_type" = 'percent' AND "reward_value" = 10;`)

  const embroidery = await db.execute(sql`
    UPDATE "spin_segments"
    SET "label" = 'Free embroidery', "reward_type" = 'freeEmbroidery', "reward_value" = 1, "updated_at" = now()
    WHERE "label" = 'QAR 100 off' AND "reward_type" = 'fixed' AND "reward_value" = 100;`)

  const care = await db.execute(sql`
    UPDATE "products"
    SET "material_care" = NULL
    WHERE "material_care"::text LIKE '%To preserve the beauty of this piece%';`)

  await db.execute(sql`
    UPDATE "_products_v"
    SET "version_material_care" = NULL
    WHERE "latest" = true
      AND "version_material_care"::text LIKE '%To preserve the beauty of this piece%';`)

  payload.logger.info({
    msg: `Her notes: 5% off ${five.rowCount ?? 0}, free embroidery ${embroidery.rowCount ?? 0}, old care text cleared ${care.rowCount ?? 0}`,
  })
}

/**
 * Puts the two prizes back. The cleared care text is not restored — she
 * struck it out, and the seed no longer carries it.
 */
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    UPDATE "spin_segments"
    SET "label" = '10% off', "reward_value" = 10, "updated_at" = now()
    WHERE "label" = '5% off' AND "reward_type" = 'percent' AND "reward_value" = 5;
    UPDATE "spin_segments"
    SET "label" = 'QAR 100 off', "reward_type" = 'fixed', "reward_value" = 100, "updated_at" = now()
    WHERE "label" = 'Free embroidery' AND "reward_type" = 'freeEmbroidery';`)
}
