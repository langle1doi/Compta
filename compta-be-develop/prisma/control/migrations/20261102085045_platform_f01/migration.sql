-- CreateEnum
CREATE TYPE "platform_admin_status" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "provisioning_job_status" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "provisioning_job_type" AS ENUM ('PROVISION', 'MIGRATE', 'EXPORT');

-- AlterTable
ALTER TABLE "plans" ADD COLUMN     "max_storage_gb" INTEGER NOT NULL DEFAULT 10;

-- AlterTable
ALTER TABLE "platform_admins" ADD COLUMN     "last_failed_login_at" TIMESTAMP(3),
ADD COLUMN     "permissions_version" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "role_id" UUID,
ADD COLUMN     "status" "platform_admin_status" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "token_version" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "platform_audit_logs" (
    "id" BIGSERIAL NOT NULL,
    "actor_id" UUID,
    "actor_email" TEXT,
    "action" TEXT NOT NULL,
    "target_type" TEXT,
    "target_id" TEXT,
    "before" JSONB,
    "after" JSONB,
    "ip" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_permissions" (
    "id" UUID NOT NULL,
    "resource" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "platform_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_refresh_tokens" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_role_permissions" (
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,

    CONSTRAINT "platform_role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "platform_roles" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_sessions" (
    "id" UUID NOT NULL,
    "admin_id" UUID NOT NULL,
    "user_agent" TEXT,
    "ip" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "platform_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provisioning_jobs" (
    "id" UUID NOT NULL,
    "type" "provisioning_job_type" NOT NULL,
    "tenant_id" UUID,
    "status" "provisioning_job_status" NOT NULL DEFAULT 'QUEUED',
    "step" TEXT,
    "steps" JSONB NOT NULL DEFAULT '[]',
    "result" JSONB,
    "secret_enc" TEXT,
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "created_by" UUID,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provisioning_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_sessions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "granted_by_id" UUID NOT NULL,
    "granted_by_email" TEXT NOT NULL,
    "reason" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "platform_admin_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_usage_snapshots" (
    "tenant_id" UUID NOT NULL,
    "users" INTEGER NOT NULL,
    "companies" INTEGER NOT NULL,
    "invoices_this_month" INTEGER NOT NULL,
    "storage_bytes" BIGINT NOT NULL,
    "captured_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_usage_snapshots_pkey" PRIMARY KEY ("tenant_id")
);

-- CreateIndex
CREATE INDEX "platform_audit_logs_action_created_at_idx" ON "platform_audit_logs"("action", "created_at");

-- CreateIndex
CREATE INDEX "platform_audit_logs_actor_email_created_at_idx" ON "platform_audit_logs"("actor_email", "created_at");

-- CreateIndex
CREATE INDEX "platform_audit_logs_target_type_target_id_idx" ON "platform_audit_logs"("target_type", "target_id");

-- CreateIndex
CREATE UNIQUE INDEX "platform_permissions_resource_action_key" ON "platform_permissions"("resource", "action");

-- CreateIndex
CREATE UNIQUE INDEX "platform_refresh_tokens_token_hash_key" ON "platform_refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "platform_refresh_tokens_session_id_idx" ON "platform_refresh_tokens"("session_id");

-- CreateIndex
CREATE UNIQUE INDEX "platform_roles_key_key" ON "platform_roles"("key");

-- CreateIndex
CREATE INDEX "platform_sessions_admin_id_revoked_at_idx" ON "platform_sessions"("admin_id", "revoked_at");

-- CreateIndex
CREATE INDEX "provisioning_jobs_status_updated_at_idx" ON "provisioning_jobs"("status", "updated_at");

-- CreateIndex
CREATE INDEX "provisioning_jobs_tenant_id_type_status_idx" ON "provisioning_jobs"("tenant_id", "type", "status");

-- CreateIndex
CREATE INDEX "support_sessions_tenant_id_expires_at_idx" ON "support_sessions"("tenant_id", "expires_at");

-- CreateIndex
CREATE INDEX "platform_admins_role_id_idx" ON "platform_admins"("role_id");

-- AddForeignKey
ALTER TABLE "platform_admins" ADD CONSTRAINT "platform_admins_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "platform_roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_refresh_tokens" ADD CONSTRAINT "platform_refresh_tokens_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "platform_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_role_permissions" ADD CONSTRAINT "platform_role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "platform_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_role_permissions" ADD CONSTRAINT "platform_role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "platform_permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_sessions" ADD CONSTRAINT "platform_sessions_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "platform_admins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provisioning_jobs" ADD CONSTRAINT "provisioning_jobs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_sessions" ADD CONSTRAINT "support_sessions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_usage_snapshots" ADD CONSTRAINT "tenant_usage_snapshots_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Hand-written
-- ---------------------------------------------------------------------------

-- Existing admins become Super Admins. Permissions of the three roles are synced from the code catalog by seed-control.
INSERT INTO "platform_roles" ("id", "key", "name", "description", "is_system", "updated_at") VALUES
  (gen_random_uuid(), 'PLATFORM_SUPER_ADMIN', 'Super Admin', 'Full access to the platform', true, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'PLATFORM_OPERATOR', 'Operator', 'Tenants, provisioning, plans, migrations', true, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'PLATFORM_SUPPORT', 'Support', 'Read tenants, plans, jobs, migrations', true, CURRENT_TIMESTAMP);
UPDATE "platform_admins" SET "role_id" = (SELECT "id" FROM "platform_roles" WHERE "key" = 'PLATFORM_SUPER_ADMIN');
ALTER TABLE "platform_admins" ALTER COLUMN "role_id" SET NOT NULL;

-- Existing plans get a storage limit in line with their other limits
UPDATE "plans" SET "max_storage_gb" = 100 WHERE "code" = 'business';

-- One active job per (type, tenant), and one platform-wide migration at a time: concurrent requests get a conflict
CREATE UNIQUE INDEX "provisioning_jobs_one_active_per_tenant" ON "provisioning_jobs" ("type", "tenant_id")
  WHERE "status" IN ('QUEUED', 'RUNNING') AND "tenant_id" IS NOT NULL;
CREATE UNIQUE INDEX "provisioning_jobs_one_active_migration" ON "provisioning_jobs" ("type")
  WHERE "type" = 'MIGRATE' AND "status" IN ('QUEUED', 'RUNNING');

-- Support access is at most 24 hours (F01 BR-05)
ALTER TABLE "support_sessions" ADD CONSTRAINT "support_sessions_max_24h_check" CHECK ("expires_at" <= "created_at" + INTERVAL '24 hours');

-- Append-only platform audit log
CREATE FUNCTION "platform_audit_logs_append_only"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'platform_audit_logs is append-only' USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "platform_audit_logs_no_update_delete" BEFORE UPDATE OR DELETE ON "platform_audit_logs"
  FOR EACH ROW EXECUTE FUNCTION "platform_audit_logs_append_only"();
CREATE TRIGGER "platform_audit_logs_no_truncate" BEFORE TRUNCATE ON "platform_audit_logs"
  FOR EACH STATEMENT EXECUTE FUNCTION "platform_audit_logs_append_only"();
