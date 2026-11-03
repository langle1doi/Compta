// Loaded before every e2e test file (and by global setup): .env (if present) + test overrides.
import 'dotenv/config';

process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = process.env.E2E_LOG_LEVEL ?? 'silent';
process.env.LOG_PRETTY = 'false';
process.env.APP_BASE_DOMAIN = 'localhost';
// Tests log in many times from the same IP; the rate limit itself is covered by throttle.e2e-spec.ts
process.env.THROTTLE_DEFAULT_LIMIT = '100000';
process.env.THROTTLE_LOGIN_LIMIT = '100000';
process.env.THROTTLE_LOGIN_EMAIL_LIMIT = '100000';
process.env.THROTTLE_MFA_LIMIT = '100000';

// Mail never leaves the machine whatever .env says: Mailpit only, and env validation refuses any other host under test.
process.env.MAIL_HOST = 'localhost';
process.env.MAIL_PORT = process.env.MAILPIT_SMTP_PORT ?? '1025';
delete process.env.MAIL_USERNAME;
delete process.env.MAIL_PASSWORD;
process.env.MAIL_FROM_EMAIL = 'noreply@compta.test';
process.env.MFA_ENFORCED = 'false';
// Its own queues and bucket, away from whatever the same broker and MinIO serve
process.env.RABBITMQ_QUEUE_PREFIX = 'compte_e2e';
process.env.S3_BUCKET = 'compte-e2e';
process.env.QUEUE_RETRY_DELAYS_MS = '100,200,300';
process.env.APP_PUBLIC_URL_TEMPLATE = 'http://{subdomain}.compta.test';
process.env.INTERNAL_PROXY_SECRET = 'e2e-internal-proxy-secret';
process.env.METRICS_TOKEN = 'e2e-metrics-token';

// A brand-new platform for every run, isolated from the dev data on the same PostgreSQL server:
// its own control DB, and tenant databases named <prefix><subdomain>. Both names can be changed through the
// environment so two runs can share a PostgreSQL server without dropping each other's databases.
const url = new URL(process.env.CONTROL_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/compte_control');
url.pathname = `/${process.env.E2E_CONTROL_DB ?? 'compte_control_e2e'}`;
process.env.CONTROL_DATABASE_URL = url.toString();
process.env.TENANT_DB_NAME_PREFIX = process.env.E2E_TENANT_DB_PREFIX ?? 'tenant_e2e_';
