-- CreateEnum
CREATE TYPE "mail_job_status" AS ENUM ('QUEUED', 'SENT', 'SKIPPED', 'FAILED');

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "db_app_password_enc" TEXT,
ADD COLUMN     "db_app_user" TEXT,
ADD COLUMN     "default_company_id" UUID;

-- CreateTable
CREATE TABLE "mail_jobs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "kind" TEXT NOT NULL,
    "status" "mail_job_status" NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "payload_enc" TEXT,
    "last_error" TEXT,
    "published_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mail_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mail_jobs_status_published_at_idx" ON "mail_jobs"("status", "published_at");
