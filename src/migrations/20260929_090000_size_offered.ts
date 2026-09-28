import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "variants" ADD COLUMN "offered" boolean DEFAULT true;`)

  /*
   * The client's note of 28 Sep 2026: XS and XL stay listed but crossed out,
   * as she cannot make them yet. Only sizes whose option reads XS or XL; she
   * ticks Offer this size (Sizes & stock) when she can.
   */
  await db.execute(sql`
   UPDATE "variants" SET "offered" = false
   WHERE "id" IN (
     SELECT r."parent_id" FROM "variants_rels" r
     JOIN "variant_options" o ON o."id" = r."variant_options_id"
     WHERE r."path" = 'options' AND upper(o."label") IN ('XS', 'XL')
   );`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "variants" DROP COLUMN "offered";`)
}
