import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "site_settings" ADD COLUMN "orders_open" boolean DEFAULT true;`)

  /*
   * The live site's own row starts paused: plumpose.com went public on
   * 28 Sep 2026 while SkipCash was still on its test system, so a real
   * customer could have "paid" on a test page. Ticking Site settings →
   * Orders → Take orders opens them, once the production keys are in.
   */
  await db.execute(sql`UPDATE "site_settings" SET "orders_open" = false;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "site_settings" DROP COLUMN "orders_open";`)
}
