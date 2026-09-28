import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "products" ALTER COLUMN "price_in_q_a_r_enabled" SET DEFAULT true;
  ALTER TABLE "_products_v" ALTER COLUMN "version_price_in_q_a_r_enabled" SET DEFAULT true;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "products" ALTER COLUMN "price_in_q_a_r_enabled" DROP DEFAULT;
  ALTER TABLE "_products_v" ALTER COLUMN "version_price_in_q_a_r_enabled" DROP DEFAULT;`)
}
