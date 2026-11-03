/*
  Warnings:

  - You are about to drop the column `is_active` on the `companies` table. All the data in the column will be lost.
  - You are about to alter the column `unit_price` on the `credit_note_lines` table. The data in that column could be lost. The data in that column will be cast from `Decimal(14,2)` to `Decimal(14,4)`.
  - You are about to alter the column `unit_price` on the `invoice_lines` table. The data in that column could be lost. The data in that column will be cast from `Decimal(14,2)` to `Decimal(14,4)`.
  - You are about to drop the column `padding` on the `number_sequences` table. All the data in the column will be lost.
  - You are about to drop the column `prefix` on the `number_sequences` table. All the data in the column will be lost.
  - You are about to alter the column `unit_price` on the `products` table. The data in that column could be lost. The data in that column will be cast from `Decimal(14,2)` to `Decimal(14,4)`.
  - You are about to alter the column `cost_price` on the `products` table. The data in that column could be lost. The data in that column will be cast from `Decimal(14,2)` to `Decimal(14,4)`.
  - You are about to alter the column `unit_price` on the `quote_lines` table. The data in that column could be lost. The data in that column will be cast from `Decimal(14,2)` to `Decimal(14,4)`.
  - You are about to drop the column `is_active` on the `users` table. All the data in the column will be lost.
  - Made the column `code` on table `customers` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `format` to the `number_sequences` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "company_status" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "customer_status" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "user_status" AS ENUM ('INVITED', 'ACTIVE', 'DISABLED');

-- AlterEnum
ALTER TYPE "document_type" ADD VALUE 'CUSTOMER';

-- AlterTable
ALTER TABLE "companies" DROP COLUMN "is_active",
ADD COLUMN     "status" "company_status" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "credit_note_lines" ALTER COLUMN "unit_price" SET DATA TYPE DECIMAL(14,4);

-- AlterTable
ALTER TABLE "credit_notes" ADD COLUMN     "company_snapshot" JSONB,
ADD COLUMN     "customer_snapshot" JSONB,
ADD COLUMN     "lock_version" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "default_tax_rate_id" UUID,
ADD COLUMN     "status" "customer_status" NOT NULL DEFAULT 'ACTIVE',
ALTER COLUMN "code" SET NOT NULL;

-- AlterTable
ALTER TABLE "invoice_lines" ALTER COLUMN "unit_price" SET DATA TYPE DECIMAL(14,4);

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "company_snapshot" JSONB,
ADD COLUMN     "customer_snapshot" JSONB,
ADD COLUMN     "lock_version" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "number_sequences" DROP COLUMN "padding",
DROP COLUMN "prefix",
ADD COLUMN     "format" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "products" ALTER COLUMN "unit_price" SET DATA TYPE DECIMAL(14,4),
ALTER COLUMN "cost_price" SET DATA TYPE DECIMAL(14,4);

-- AlterTable
ALTER TABLE "quote_lines" ALTER COLUMN "unit_price" SET DATA TYPE DECIMAL(14,4);

-- AlterTable
ALTER TABLE "quotes" ADD COLUMN     "company_snapshot" JSONB,
ADD COLUMN     "customer_snapshot" JSONB,
ADD COLUMN     "lock_version" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "is_active",
ADD COLUMN     "status" "user_status" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "token_version" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "tax_rates" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "rate" DECIMAL(5,2) NOT NULL,
    "label" TEXT NOT NULL,
    "legal_mention" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_rates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tax_rates_company_id_label_key" ON "tax_rates"("company_id", "label");

-- CreateIndex
CREATE INDEX "customers_company_id_siret_idx" ON "customers"("company_id", "siret");

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_default_tax_rate_id_fkey" FOREIGN KEY ("default_tax_rate_id") REFERENCES "tax_rates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_rates" ADD CONSTRAINT "tax_rates_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Hand-written: constraints Prisma schema cannot express
-- ---------------------------------------------------------------------------

-- At most one tenant-wide membership (company_id IS NULL) per user
DROP INDEX "memberships_user_id_company_id_key";
CREATE UNIQUE INDEX "memberships_user_id_company_id_key" ON "memberships"("user_id", "company_id") NULLS NOT DISTINCT;

-- F03 BR-04: a 0% rate must carry a legal mention
ALTER TABLE "tax_rates" ADD CONSTRAINT "tax_rates_rate_range_check" CHECK ("rate" >= 0 AND "rate" <= 100);
ALTER TABLE "tax_rates" ADD CONSTRAINT "tax_rates_zero_rate_mention_check"
  CHECK ("rate" <> 0 OR ("legal_mention" IS NOT NULL AND btrim("legal_mention") <> ''));

-- F16 BR-01: audit log is append-only
CREATE FUNCTION "audit_logs_append_only"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only' USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "audit_logs_no_update_delete" BEFORE UPDATE OR DELETE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION "audit_logs_append_only"();
CREATE TRIGGER "audit_logs_no_truncate" BEFORE TRUNCATE ON "audit_logs"
  FOR EACH STATEMENT EXECUTE FUNCTION "audit_logs_append_only"();
