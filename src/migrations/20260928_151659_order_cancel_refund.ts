import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_orders_fulfilment" ADD VALUE 'cancelled';
  ALTER TYPE "public"."enum_orders_fulfilment" ADD VALUE 'refunded';
  ALTER TABLE "orders" ADD COLUMN "cancelled_email_sent_at" timestamp(3) with time zone;
  ALTER TABLE "orders" ADD COLUMN "refunded_email_sent_at" timestamp(3) with time zone;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  // An enum value cannot go while rows use it: closed orders read Delivered, status stays as set.
  await db.execute(sql`
   UPDATE "orders" SET "fulfilment" = 'delivered' WHERE "fulfilment"::text IN ('cancelled', 'refunded');`)
  await db.execute(sql`
   ALTER TABLE "orders" ALTER COLUMN "fulfilment" SET DATA TYPE text;
  ALTER TABLE "orders" ALTER COLUMN "fulfilment" SET DEFAULT 'unfulfilled'::text;
  DROP TYPE "public"."enum_orders_fulfilment";
  CREATE TYPE "public"."enum_orders_fulfilment" AS ENUM('unfulfilled', 'inAtelier', 'shipped', 'delivered');
  ALTER TABLE "orders" ALTER COLUMN "fulfilment" SET DEFAULT 'unfulfilled'::"public"."enum_orders_fulfilment";
  ALTER TABLE "orders" ALTER COLUMN "fulfilment" SET DATA TYPE "public"."enum_orders_fulfilment" USING "fulfilment"::"public"."enum_orders_fulfilment";
  ALTER TABLE "orders" DROP COLUMN "cancelled_email_sent_at";
  ALTER TABLE "orders" DROP COLUMN "refunded_email_sent_at";`)
}
