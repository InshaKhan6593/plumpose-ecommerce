import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "shipping_cities_zone_fees" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"zone" numeric NOT NULL,
  	"fee_qar" numeric NOT NULL
  );
  
  ALTER TABLE "shipping_cities_zone_fees" ADD CONSTRAINT "shipping_cities_zone_fees_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."shipping_cities"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "shipping_cities_zone_fees_order_idx" ON "shipping_cities_zone_fees" USING btree ("_order");
  CREATE INDEX "shipping_cities_zone_fees_parent_id_idx" ON "shipping_cities_zone_fees" USING btree ("_parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "shipping_cities_zone_fees" CASCADE;`)
}
