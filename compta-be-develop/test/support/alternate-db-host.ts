// Imported first by db-cluster.e2e-spec.ts: ConfigModule validates the environment when AppModule is imported.
// Global setup seeded the platform with TENANT_DB_HOST from .env (localhost). The same server under another
// address stands in for "same data, other side of the container boundary".
export const ALTERNATE_DB_HOST = '127.0.0.1';
process.env.TENANT_DB_HOST = ALTERNATE_DB_HOST;
