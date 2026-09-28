import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "page_text" ALTER COLUMN "shipping_intro" SET DEFAULT 'At plumpose, every order is carefully prepared before making its way to you.';
  ALTER TABLE "page_text" ALTER COLUMN "shipping_delivery_qatar_note" SET DEFAULT 'A flat rate by city, shown at checkout. Delivery times depend on your destination.';
  ALTER TABLE "page_text" ALTER COLUMN "shipping_delivery_intl_heading" SET DEFAULT 'GCC & worldwide';
  ALTER TABLE "page_text" ALTER COLUMN "shipping_delivery_intl_note" SET DEFAULT 'A flat rate by destination, shown at checkout before you pay. International orders are generally delivered within 14 business days after dispatch.';
  ALTER TABLE "page_text" ALTER COLUMN "shipping_delivery_timing" SET DEFAULT 'Delivery estimates do not include delays caused by customs clearance, public holidays, incorrect delivery information, courier disruptions or circumstances outside our control.';
  ALTER TABLE "page_text" ALTER COLUMN "shipping_returns_intro" SET DEFAULT 'We want you to love your plumpose piece. Because our garments are delicate and carefully prepared, returns and exchanges have specific conditions. To be eligible, items must:';
  ALTER TABLE "page_text" ALTER COLUMN "shipping_returns_terms" SET DEFAULT 'Be unused and unworn
  Be unwashed
  Be in their original condition
  Have all original tags and packaging attached
  Show no signs of perfume, makeup, stains, damage or alteration';
  ALTER TABLE "page_text" ALTER COLUMN "shipping_returns_exception" SET DEFAULT 'Custom-made, personalised, altered or specially commissioned pieces are generally non-returnable unless they arrive damaged or defective. For hygiene and product-integrity reasons, certain other items may not be eligible either.';
  ALTER TABLE "page_text" ALTER COLUMN "shipping_returns_contact" SET DEFAULT 'For returns, exchanges or refunds, write to us:';
  ALTER TABLE "site_settings" ADD COLUMN "return_window_days" numeric DEFAULT 14 NOT NULL;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "page_text" ALTER COLUMN "shipping_intro" SET DEFAULT 'We’re pleased to offer delivery across Qatar and worldwide.';
  ALTER TABLE "page_text" ALTER COLUMN "shipping_delivery_qatar_note" SET DEFAULT 'A flat rate by city, shown at checkout.';
  ALTER TABLE "page_text" ALTER COLUMN "shipping_delivery_intl_heading" SET DEFAULT 'Worldwide';
  ALTER TABLE "page_text" ALTER COLUMN "shipping_delivery_intl_note" SET DEFAULT 'A flat rate by destination, shown at checkout before you pay.';
  ALTER TABLE "page_text" ALTER COLUMN "shipping_delivery_timing" SET DEFAULT 'Every piece is hand-finished to order. Delivery times may vary with location and customs; your order confirmation email sets out what happens next, and you can follow it from Track order.';
  ALTER TABLE "page_text" ALTER COLUMN "shipping_returns_intro" SET DEFAULT 'We hope you love every piece as much as we loved creating it. If you’re not completely satisfied, we offer returns and exchanges under the following terms:';
  ALTER TABLE "page_text" ALTER COLUMN "shipping_returns_terms" SET DEFAULT 'Returns and exchanges accepted within 14 days of delivery.
  Items must be unworn, unwashed and in original condition, with all packaging and tags intact.
  For hygiene and quality, any item showing signs of wear, washing, damage or alteration cannot be accepted.
  Original shipping charges are non-refundable.
  Customers cover return shipping unless the item is faulty or incorrect.
  For a damaged or incorrect item, contact us within 48 hours of delivery.
  Approved refunds are processed to the original payment method once the return is received and inspected.';
  ALTER TABLE "page_text" ALTER COLUMN "shipping_returns_exception" SET DEFAULT 'Personalised or monogrammed pieces are not eligible for return or exchange.';
  ALTER TABLE "page_text" ALTER COLUMN "shipping_returns_contact" SET DEFAULT 'For any return or exchange enquiry, write to us or send a message on Instagram. Our team will attend to you.';
  ALTER TABLE "site_settings" DROP COLUMN "return_window_days";`)
}
