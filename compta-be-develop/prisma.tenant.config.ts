import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

// TENANT_DATABASE_URL is overridden per tenant by the provisioner and scripts/migrate-tenants.ts
export default defineConfig({
  schema: 'prisma/tenant',
  migrations: { path: 'prisma/tenant/migrations' },
  datasource: { url: env('TENANT_DATABASE_URL') },
});
