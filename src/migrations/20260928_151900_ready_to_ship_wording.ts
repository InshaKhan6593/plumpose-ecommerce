import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Data only — her newest words (shipping text of 28 Sep 2026: ready-to-ship
 * orders go out in 2–4 business days) over the old "each piece hand-finished
 * to order", and her returns contact (email or WhatsApp, no longer
 * Instagram). Each change applies only to the seeded text exactly as it was,
 * so anything she has edited herself is left alone. The schema snapshot is
 * the previous migration's: nothing structural changes.
 */
const OLD_BAR = 'RESORT 2026 · NOW SHIPPING WORLDWIDE · EACH PIECE HAND-FINISHED TO ORDER'
const NEW_BAR = 'RESORT 2026 · NOW SHIPPING WORLDWIDE · HAND EMBROIDERY AVAILABLE'
const FAQ = [
  [
    'Every piece is hand-finished to order.',
    'Ready-to-ship orders are prepared and dispatched within 2–4 business days.',
  ],
  ['or send us a message on Instagram within', 'or message us on WhatsApp within'],
] as const

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(
    sql`UPDATE "site_settings" SET "announcement_text" = ${NEW_BAR} WHERE "announcement_text" = ${OLD_BAR};`,
  )
  for (const [from, to] of FAQ) {
    await db.execute(sql`
      UPDATE "faqs" SET "answer" = replace("answer"::text, ${from}, ${to})::jsonb
      WHERE "answer"::text LIKE ${'%' + from + '%'};`)
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(
    sql`UPDATE "site_settings" SET "announcement_text" = ${OLD_BAR} WHERE "announcement_text" = ${NEW_BAR};`,
  )
  for (const [from, to] of FAQ) {
    await db.execute(sql`
      UPDATE "faqs" SET "answer" = replace("answer"::text, ${to}, ${from})::jsonb
      WHERE "answer"::text LIKE ${'%' + to + '%'};`)
  }
}
