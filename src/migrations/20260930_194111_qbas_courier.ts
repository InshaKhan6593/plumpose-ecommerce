import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * The courier on an order (QBAS, BUILD-LOG §69): the customer's delivery zone
 * and the courier record — tracking number, status, the timeline.
 *
 * Generated, then trimmed: the generator also re-added the Cancelled /
 * Refunded fulfilment values and their email dates, which
 * 20260928_151659_order_cancel_refund already created (its snapshot did not
 * record them). Only the courier changes are here.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  CREATE TABLE "orders_courier_events" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"code" varchar NOT NULL,
  	"notes" varchar,
  	"at" timestamp(3) with time zone NOT NULL
  );

  ALTER TABLE "orders" ADD COLUMN "delivery_zone" numeric;
  ALTER TABLE "orders" ADD COLUMN "courier_barcode" varchar;
  ALTER TABLE "orders" ADD COLUMN "courier_package_id" numeric;
  ALTER TABLE "orders" ADD COLUMN "courier_status" varchar;
  ALTER TABLE "orders" ADD COLUMN "courier_status_at" timestamp(3) with time zone;
  ALTER TABLE "orders" ADD COLUMN "courier_booked_at" timestamp(3) with time zone;
  ALTER TABLE "orders" ADD COLUMN "courier_checked_at" timestamp(3) with time zone;
  ALTER TABLE "orders" ADD COLUMN "courier_cost" numeric;
  ALTER TABLE "orders" ADD COLUMN "courier_error" varchar;
  ALTER TABLE "orders" ADD COLUMN "courier_alerted_status" varchar;
  ALTER TABLE "orders_courier_events" ADD CONSTRAINT "orders_courier_events_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "orders_courier_events_order_idx" ON "orders_courier_events" USING btree ("_order");
  CREATE INDEX "orders_courier_events_parent_id_idx" ON "orders_courier_events" USING btree ("_parent_id");
  CREATE INDEX "orders_courier_courier_barcode_idx" ON "orders" USING btree ("courier_barcode");
  CREATE INDEX "orders_courier_courier_status_idx" ON "orders" USING btree ("courier_status");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  DROP TABLE "orders_courier_events" CASCADE;
  DROP INDEX "orders_courier_courier_barcode_idx";
  DROP INDEX "orders_courier_courier_status_idx";
  ALTER TABLE "orders" DROP COLUMN "delivery_zone";
  ALTER TABLE "orders" DROP COLUMN "courier_barcode";
  ALTER TABLE "orders" DROP COLUMN "courier_package_id";
  ALTER TABLE "orders" DROP COLUMN "courier_status";
  ALTER TABLE "orders" DROP COLUMN "courier_status_at";
  ALTER TABLE "orders" DROP COLUMN "courier_booked_at";
  ALTER TABLE "orders" DROP COLUMN "courier_checked_at";
  ALTER TABLE "orders" DROP COLUMN "courier_cost";
  ALTER TABLE "orders" DROP COLUMN "courier_error";
  ALTER TABLE "orders" DROP COLUMN "courier_alerted_status";`)
}
