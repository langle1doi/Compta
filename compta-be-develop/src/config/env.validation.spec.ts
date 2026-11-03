import { validateEnv } from './env.validation';

const base = {
  APP_BASE_DOMAIN: 'app.example.test',
  CONTROL_DATABASE_URL: 'postgresql://u:p@localhost/c',
  TENANT_DB_ADMIN_URL: 'postgresql://u:p@localhost/postgres',
  TENANT_DB_HOST: 'localhost',
  DB_CREDENTIALS_KEY: Buffer.alloc(32, 7).toString('base64'),
  JWT_SECRET: 'a'.repeat(48),
  PLATFORM_JWT_SECRET: 'b'.repeat(48),
  RABBITMQ_URL: 'amqp://u:p@localhost:5672',
  S3_ENDPOINT: 'http://localhost:9000',
  S3_ACCESS_KEY: 'access-key-for-tests',
  S3_SECRET_KEY: 'secret-key-for-tests',
};

const production = {
  NODE_ENV: 'production',
  INTERNAL_PROXY_SECRET: 'c'.repeat(48),
  METRICS_TOKEN: 'd'.repeat(48),
  APP_PUBLIC_URL_TEMPLATE: 'https://{subdomain}.example.test',
};

describe('validateEnv', () => {
  it('accepts a valid config and converts types', () => {
    const env = validateEnv({ ...base, PORT: '4000', LOG_PRETTY: 'false' });
    expect(env.PORT).toBe(4000);
    expect(env.LOG_PRETTY).toBe(false);
  });

  it('rejects a DB_CREDENTIALS_KEY that is not 32 bytes', () => {
    expect(() => validateEnv({ ...base, DB_CREDENTIALS_KEY: Buffer.alloc(16).toString('base64') + 'xxxxxxxxxxxxxxxxxxxx' })).toThrow(
      /32 bytes/,
    );
  });

  it('refuses to start in production with placeholder secrets', () => {
    expect(() => validateEnv({ ...base, ...production, JWT_SECRET: 'change-me-to-a-long-random-string-xxxxxx' })).toThrow(
      /JWT_SECRET still has its placeholder value/,
    );
  });

  it('refuses pretty logs in production', () => {
    expect(() => validateEnv({ ...base, ...production, LOG_PRETTY: 'true' })).toThrow(/LOG_PRETTY/);
  });

  it('rejects an unsafe tenant database name prefix', () => {
    expect(() => validateEnv({ ...base, TENANT_DB_NAME_PREFIX: 'x; drop' })).toThrow(/TENANT_DB_NAME_PREFIX/);
  });

  describe('BE-INF-07 production refuses to start', () => {
    const prod = { ...base, ...production };
    it.each([
      ['a default RabbitMQ password', { RABBITMQ_URL: 'amqp://compte:compte-dev-rabbitmq@rabbit:5672' }, /RABBITMQ_URL/],
      ['guest on RabbitMQ', { RABBITMQ_URL: 'amqp://guest:guest@rabbit:5672' }, /RABBITMQ_URL/],
      ['a default MinIO key', { S3_ACCESS_KEY: 'minioadmin' }, /S3_ACCESS_KEY/],
      ['a default MinIO secret', { S3_SECRET_KEY: 'compte-dev-minio' }, /S3_SECRET_KEY/],
      ['a placeholder platform secret', { PLATFORM_JWT_SECRET: 'change-me-to-a-long-random-string-xxxxxx' }, /PLATFORM_JWT_SECRET/],
      ['the same secret for tenant and platform', { PLATFORM_JWT_SECRET: base.JWT_SECRET }, /must differ/],
      ['no proxy secret', { INTERNAL_PROXY_SECRET: undefined }, /INTERNAL_PROXY_SECRET/],
      ['no public URL template', { APP_PUBLIC_URL_TEMPLATE: undefined }, /APP_PUBLIC_URL_TEMPLATE/],
    ])('with %s', (_, override, message) => {
      expect(() => validateEnv({ ...prod, ...override })).toThrow(message);
    });
  });

  it('E-INF-07 missing or malformed values refuse to start, and the message prints no value', () => {
    const { RABBITMQ_URL: _dropped, ...missing } = base;
    expect(() => validateEnv(missing)).toThrow(/RABBITMQ_URL/);
    const secret = 'not-base64-very-secret-value';
    let message = '';
    try {
      validateEnv({
        ...base,
        DB_CREDENTIALS_KEY: secret,
        RABBITMQ_URL: 'amqp://u:super-secret-password@host',
        NODE_ENV: 'production',
        LOG_PRETTY: 'true',
      });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toMatch(/DB_CREDENTIALS_KEY/);
    expect(message).not.toContain(secret);
    expect(message).not.toContain('super-secret-password');
  });

  it('never allows a real SMTP server under test', () => {
    expect(() => validateEnv({ ...base, NODE_ENV: 'test', MAIL_HOST: 'sandbox.smtp.example', MAIL_FROM_EMAIL: 'a@b.test' })).toThrow(
      /MAIL_HOST must be local/,
    );
  });

  it('accepts real secrets in production', () => {
    expect(validateEnv({ ...base, ...production }).NODE_ENV).toBe('production');
  });
});
