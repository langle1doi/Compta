/*
  Warnings:

  - You are about to drop the column `db_host` on the `tenants` table. All the data in the column will be lost.
  - You are about to drop the column `db_port` on the `tenants` table. All the data in the column will be lost.

*/
-- A tenant no longer stores a network address: the same PostgreSQL is "postgres" inside docker compose and
-- "localhost" outside. Host and port now come from TENANT_DB_HOST / TENANT_DB_PORT at runtime.
-- The DEFAULT puts every existing tenant in the "default" cluster.
-- AlterTable
ALTER TABLE "tenants" DROP COLUMN "db_host",
DROP COLUMN "db_port",
ADD COLUMN     "db_cluster" TEXT NOT NULL DEFAULT 'default';
