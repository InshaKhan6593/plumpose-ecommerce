import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_discount_codes_type" ADD VALUE 'freeEmbroidery';
  ALTER TYPE "public"."enum_spin_segments_reward_type" ADD VALUE 'freeEmbroidery' BEFORE 'rollAgain';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  // A value cannot leave an enum while rows use it: switch those off first.
  await db.execute(sql`
   UPDATE "spin_segments" SET "reward_type" = 'rollAgain', "active" = false WHERE "reward_type" = 'freeEmbroidery';
  UPDATE "discount_codes" SET "type" = 'percent', "value" = 0, "active" = false WHERE "type" = 'freeEmbroidery';
  ALTER TABLE "discount_codes" ALTER COLUMN "type" SET DATA TYPE text;
  ALTER TABLE "discount_codes" ALTER COLUMN "type" SET DEFAULT 'percent'::text;
  DROP TYPE "public"."enum_discount_codes_type";
  CREATE TYPE "public"."enum_discount_codes_type" AS ENUM('percent', 'fixed', 'freeShipping');
  ALTER TABLE "discount_codes" ALTER COLUMN "type" SET DEFAULT 'percent'::"public"."enum_discount_codes_type";
  ALTER TABLE "discount_codes" ALTER COLUMN "type" SET DATA TYPE "public"."enum_discount_codes_type" USING "type"::"public"."enum_discount_codes_type";
  ALTER TABLE "spin_segments" ALTER COLUMN "reward_type" SET DATA TYPE text;
  ALTER TABLE "spin_segments" ALTER COLUMN "reward_type" SET DEFAULT 'percent'::text;
  DROP TYPE "public"."enum_spin_segments_reward_type";
  CREATE TYPE "public"."enum_spin_segments_reward_type" AS ENUM('percent', 'fixed', 'freeShipping', 'rollAgain');
  ALTER TABLE "spin_segments" ALTER COLUMN "reward_type" SET DEFAULT 'percent'::"public"."enum_spin_segments_reward_type";
  ALTER TABLE "spin_segments" ALTER COLUMN "reward_type" SET DATA TYPE "public"."enum_spin_segments_reward_type" USING "reward_type"::"public"."enum_spin_segments_reward_type";`)
}
