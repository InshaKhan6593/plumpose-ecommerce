import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "page_text" ALTER COLUMN "track_intro" SET DEFAULT 'Enter the email you ordered with and your order code (it begins PLM-). We will email you a private link to your order and where it is.';
  ALTER TABLE "orders" ADD COLUMN "reference" varchar;
  CREATE UNIQUE INDEX "orders_reference_idx" ON "orders" USING btree ("reference");`)

  /*
   * Existing orders take the reference of their payment (the SkipCash
   * Transaction ID) — a succeeded payment first, if an order has several.
   */
  await db.execute(sql`
  UPDATE "orders" o SET "reference" = pick.ref
  FROM (
    SELECT DISTINCT ON (r."parent_id") r."parent_id" AS order_id, t."skipcash_reference" AS ref
    FROM "orders_rels" r
    JOIN "transactions" t ON t."id" = r."transactions_id"
    WHERE r."path" = 'transactions' AND t."skipcash_reference" IS NOT NULL
    ORDER BY r."parent_id", (t."status" = 'succeeded') DESC, t."id" DESC
  ) pick
  WHERE o."id" = pick.order_id AND o."reference" IS NULL;`)

  // Any other order (made before SkipCash, or without a payment) gets a code of the same form.
  await db.execute(sql`
  UPDATE "orders" SET "reference" =
    'PLM-' || to_char("created_at" AT TIME ZONE 'UTC', 'YYMMDD') || '-' ||
    upper(substr(md5(random()::text || "id"::text), 1, 6))
  WHERE "reference" IS NULL;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "orders_reference_idx";
  ALTER TABLE "page_text" ALTER COLUMN "track_intro" SET DEFAULT 'Enter the email you ordered with and your order number. We will email you a private link to your order and where it is.';
  ALTER TABLE "orders" DROP COLUMN "reference";`)
}
