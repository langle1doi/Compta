-- AlterEnum
ALTER TYPE "tenant_status" ADD VALUE 'DELETED';

-- AlterTable
ALTER TABLE "platform_admins" ADD COLUMN     "failed_login_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "locked_until" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "failure_reason" TEXT,
ADD COLUMN     "provisioning_input" JSONB,
ADD COLUMN     "schema_version" TEXT,
ADD COLUMN     "suspended_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "tenants_status_idx" ON "tenants"("status");
