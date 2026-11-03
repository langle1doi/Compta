-- AlterTable
ALTER TABLE "tenant_usage_snapshots" ADD COLUMN     "database_bytes" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "files_bytes" BIGINT NOT NULL DEFAULT 0;
