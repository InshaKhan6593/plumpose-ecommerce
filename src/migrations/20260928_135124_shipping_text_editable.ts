import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "page_text_shipping_returns_more" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"body" varchar
  );
  
  ALTER TABLE "page_text" ADD COLUMN "shipping_preparation_heading" varchar DEFAULT 'Order preparation';
  ALTER TABLE "page_text" ADD COLUMN "shipping_preparation_body" varchar DEFAULT 'Ready-to-ship orders are generally prepared and dispatched within 2–4 business days after your order is confirmed.
  
  During launches, special projects, promotions or periods of high demand, preparation times may occasionally be longer. If this applies to your order, we will communicate the expected timeframe.';
  ALTER TABLE "page_text" ADD COLUMN "shipping_customs_heading" varchar DEFAULT 'Customs & duties';
  ALTER TABLE "page_text" ADD COLUMN "shipping_customs_body" varchar DEFAULT 'International and GCC orders may be subject to customs duties, taxes or other import charges imposed by the destination country. Any such charges are the responsibility of the customer unless otherwise stated at checkout.';
  ALTER TABLE "page_text" ADD COLUMN "shipping_delivery_info_heading" varchar DEFAULT 'Delivery information';
  ALTER TABLE "page_text" ADD COLUMN "shipping_delivery_info_body" varchar DEFAULT 'Please make sure your delivery address and contact details are accurate before completing your order. We cannot be responsible for delays caused by incorrect or incomplete delivery information.';
  ALTER TABLE "page_text" ADD COLUMN "shipping_delivery_info_contact" varchar DEFAULT 'For questions about an order or its delivery, message us on WhatsApp.';
  ALTER TABLE "page_text" ADD COLUMN "shipping_returns_not_accepted" varchar DEFAULT 'Items that do not meet these conditions may not be accepted.';
  ALTER TABLE "page_text" ADD COLUMN "shipping_returns_request_heading" varchar DEFAULT 'Requesting a return or exchange';
  ALTER TABLE "page_text" ADD COLUMN "shipping_returns_request_body" varchar DEFAULT 'Contact us within {days} days of receiving your order, with your order number and the reason for your request. Once your request has been reviewed and approved, we will send you instructions for the return.';
  ALTER TABLE "page_text_shipping_returns_more" ADD CONSTRAINT "page_text_shipping_returns_more_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."page_text"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "page_text_shipping_returns_more_order_idx" ON "page_text_shipping_returns_more" USING btree ("_order");
  CREATE INDEX "page_text_shipping_returns_more_parent_id_idx" ON "page_text_shipping_returns_more" USING btree ("_parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "page_text_shipping_returns_more" CASCADE;
  ALTER TABLE "page_text" DROP COLUMN "shipping_preparation_heading";
  ALTER TABLE "page_text" DROP COLUMN "shipping_preparation_body";
  ALTER TABLE "page_text" DROP COLUMN "shipping_customs_heading";
  ALTER TABLE "page_text" DROP COLUMN "shipping_customs_body";
  ALTER TABLE "page_text" DROP COLUMN "shipping_delivery_info_heading";
  ALTER TABLE "page_text" DROP COLUMN "shipping_delivery_info_body";
  ALTER TABLE "page_text" DROP COLUMN "shipping_delivery_info_contact";
  ALTER TABLE "page_text" DROP COLUMN "shipping_returns_not_accepted";
  ALTER TABLE "page_text" DROP COLUMN "shipping_returns_request_heading";
  ALTER TABLE "page_text" DROP COLUMN "shipping_returns_request_body";`)
}
