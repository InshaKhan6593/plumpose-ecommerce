import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "orders_courier_events" ADD COLUMN "driver_name" varchar;
  ALTER TABLE "orders_courier_events" ADD COLUMN "driver_phone" varchar;
  ALTER TABLE "orders_courier_events" ADD COLUMN "attachment_urls" varchar;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "orders_courier_events" DROP COLUMN "driver_name";
  ALTER TABLE "orders_courier_events" DROP COLUMN "driver_phone";
  ALTER TABLE "orders_courier_events" DROP COLUMN "attachment_urls";`)
}
