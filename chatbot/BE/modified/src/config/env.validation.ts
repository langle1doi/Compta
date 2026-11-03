import { plainToInstance, Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Min, MinLength, validateSync } from 'class-validator';

// Reads the raw value: implicit conversion would turn the string "false" into true.
const toBool = ({ obj, key }: { obj: Record<string, unknown>; key: string }) => {
  const raw = obj[key];
  return raw === true || raw === 'true' || raw === '1';
};

// For security switches that are on by default: only an explicit false turns them off, an empty value does not.
const toBoolDefaultTrue = ({ obj, key }: { obj: Record<string, unknown>; key: string }) => {
  const raw = obj[key];
  return !(raw === false || raw === 'false' || raw === '0');
};

export class EnvironmentVariables {
  @IsIn(['development', 'production', 'test'])
  NODE_ENV: 'development' | 'production' | 'test' = 'development';

  @IsInt()
  PORT: number = 3000;

  @IsIn(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
  LOG_LEVEL: string = 'info';

  /** Pretty, human-readable logs (development only). */
  @Transform(toBool)
  @IsBoolean()
  LOG_PRETTY: boolean = false;

  /**
   * Shared with the frontend proxy, which sends the real client address as X-Client-Ip with this secret in
   * X-Internal-Proxy-Secret. Required in production. Without a match the socket address is used.
   */
  @IsOptional()
  @IsString()
  INTERNAL_PROXY_SECRET?: string;

  /** Bearer token of GET /metrics. Unset: the endpoint answers 404. */
  @IsOptional()
  @IsString()
  METRICS_TOKEN?: string;

  /** OpenAI API key of the chat assistant. Unset (or on OpenAI failure): the assistant answers locally by keyword matching. */
  @IsOptional()
  @IsString()
  OPENAI_API_KEY?: string;

  @IsString()
  ASSISTANT_MODEL: string = 'gpt-4o-mini';

  /** Error tracking. Unset: Sentry stays off. */
  @IsOptional()
  @IsString()
  SENTRY_DSN?: string;

  @IsString()
  @IsNotEmpty()
  APP_BASE_DOMAIN: string;

  /** Extra allowed CORS origins, comma separated. *.APP_BASE_DOMAIN is always allowed. */
  @IsOptional()
  @IsString()
  CORS_ORIGINS?: string;

  /** Base URL of the tenant frontend used in emails, e.g. https://{subdomain}.compta.dfm-europe.com. Required in production. */
  @IsOptional()
  @Matches(/^https?:\/\/\S*\{subdomain\}\S*$/, { message: 'APP_PUBLIC_URL_TEMPLATE must be a URL containing {subdomain}' })
  APP_PUBLIC_URL_TEMPLATE?: string;

  @IsString()
  @IsNotEmpty()
  CONTROL_DATABASE_URL: string;

  @IsString()
  @IsNotEmpty()
  TENANT_DB_ADMIN_URL: string;

  /** Address of the "default" tenant database cluster, as seen from this process (differs inside a container). */
  @IsString()
  @IsNotEmpty()
  TENANT_DB_HOST: string;

  @IsInt()
  TENANT_DB_PORT: number = 5432;

  /** Database and role name prefix of tenant databases: <prefix><subdomain>. Lets several environments share a cluster. */
  @Matches(/^[a-z][a-z0-9_]{0,20}$/)
  TENANT_DB_NAME_PREFIX: string = 'tenant_';

  @IsString()
  @MinLength(40)
  DB_CREDENTIALS_KEY: string;

  @IsString()
  @MinLength(32)
  JWT_SECRET: string;

  /** Signs Super Admin tokens only. Production refuses to start when it equals JWT_SECRET. */
  @IsString()
  @MinLength(32)
  PLATFORM_JWT_SECRET: string;

  @IsString()
  JWT_EXPIRES_IN: string = '15m';

  /** Session ends after this long without activity (F02 AC-07). */
  @IsInt()
  @Min(1)
  SESSION_IDLE_MINUTES: number = 30;

  /** Session ends this long after login whatever the activity (F02 AC-07). */
  @IsInt()
  @Min(1)
  SESSION_MAX_HOURS: number = 12;

  /** Lifetime of one refresh token (F02 BR-02). The session limits above still apply. */
  @IsInt()
  @Min(1)
  REFRESH_TOKEN_DAYS: number = 7;

  /**
   * E-SESS-01: a refresh token used again within this many seconds, from the same client, is two tabs racing and not
   * a theft. 0 turns the grace off: any second use revokes the session.
   */
  @IsInt()
  @Min(0)
  REFRESH_REUSE_GRACE_SECONDS: number = 10;

  /** F02 BR-03: mandatory 2FA for Admin tenant, Owner and Accountant. */
  @Transform(toBoolDefaultTrue)
  @IsBoolean()
  MFA_ENFORCED: boolean = true;

  @IsInt()
  @Min(1)
  LOGIN_MAX_ATTEMPTS: number = 5;

  @IsInt()
  @Min(1)
  LOGIN_LOCK_MINUTES: number = 15;

  /** Requests per minute per IP, all routes. */
  @IsInt()
  @Min(1)
  THROTTLE_DEFAULT_LIMIT: number = 120;

  /** Requests per minute per IP on login endpoints. */
  @IsInt()
  @Min(1)
  THROTTLE_LOGIN_LIMIT: number = 10;

  /** Requests per minute per email address on login endpoints. */
  @IsInt()
  @Min(1)
  THROTTLE_LOGIN_EMAIL_LIMIT: number = 10;

  /** Requests per minute per IP on 2FA code endpoints (F02 G: 5/min). */
  @IsInt()
  @Min(1)
  THROTTLE_MFA_LIMIT: number = 5;

  @IsString()
  @Matches(/^amqps?:\/\//, { message: 'RABBITMQ_URL must be an amqp:// or amqps:// URL' })
  RABBITMQ_URL: string;

  /** Queue names are <prefix>.<queue>: lets environments share a broker. */
  @Matches(/^[a-z][a-z0-9_-]{0,30}$/)
  RABBITMQ_QUEUE_PREFIX: string = 'compte';

  /** Delay before each retry, comma separated: the number of values is the number of retries. */
  @Matches(/^\d+(,\d+)*$/)
  QUEUE_RETRY_DELAYS_MS: string = '2000,10000,60000';

  /** Consume queues in this process. Set false on pods that only serve HTTP. */
  @Transform(toBoolDefaultTrue)
  @IsBoolean()
  WORKER_ENABLED: boolean = true;

  @IsString()
  @IsNotEmpty()
  S3_ENDPOINT: string;

  /** Endpoint written in presigned URLs: what the browser can reach. Defaults to S3_ENDPOINT. */
  @IsOptional()
  @IsString()
  S3_PUBLIC_ENDPOINT?: string;

  @IsString()
  S3_REGION: string = 'us-east-1';

  @IsString()
  @IsNotEmpty()
  S3_ACCESS_KEY: string;

  @IsString()
  @IsNotEmpty()
  S3_SECRET_KEY: string;

  @Matches(/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/)
  S3_BUCKET: string = 'compte';

  /** SMTP server. Empty = no email is sent, and the system says so where it matters. */
  @IsOptional()
  @IsString()
  MAIL_HOST?: string;

  @IsInt()
  @Min(1)
  MAIL_PORT: number = 587;

  @IsOptional()
  @IsString()
  MAIL_USERNAME?: string;

  @IsOptional()
  @IsString()
  MAIL_PASSWORD?: string;

  @IsString()
  MAIL_FROM_NAME: string = 'COMPTA';

  @IsOptional()
  @IsString()
  MAIL_FROM_EMAIL?: string;

  /** Drops the database of DELETED tenants 30 days later (F01 BR-06), only once they have an export. Off unless explicitly enabled. */
  @Transform(toBool)
  @IsBoolean()
  TENANT_PURGE_ENABLED: boolean = false;
}

// Values shipped in .env.example; production must never start with them.
const PLACEHOLDER_MARKERS = ['change-me', 'changeme', 'example'];
const DEFAULT_BROKER_PASSWORDS = ['guest', 'compte-dev-rabbitmq'];
const DEFAULT_STORAGE_KEYS = ['minioadmin', 'compte', 'compte-dev-minio'];
const LOOPBACK_HOSTS = ['localhost', '127.0.0.1', '::1', 'mailpit'];

const isPlaceholder = (value: string) => PLACEHOLDER_MARKERS.some((m) => value.toLowerCase().includes(m));

function brokerPassword(url: string): string {
  try {
    return decodeURIComponent(new URL(url).password);
  } catch {
    return '';
  }
}

function productionErrors(env: EnvironmentVariables): string[] {
  if (env.NODE_ENV !== 'production') return [];
  const errors: string[] = [];
  for (const key of ['JWT_SECRET', 'PLATFORM_JWT_SECRET', 'DB_CREDENTIALS_KEY'] as const) {
    if (isPlaceholder(env[key] ?? '')) errors.push(`${key} still has its placeholder value`);
  }
  if (env.JWT_SECRET === env.PLATFORM_JWT_SECRET) errors.push('PLATFORM_JWT_SECRET must differ from JWT_SECRET');
  if (env.LOG_PRETTY) errors.push('LOG_PRETTY must be false in production');
  if (!env.APP_PUBLIC_URL_TEMPLATE) errors.push('APP_PUBLIC_URL_TEMPLATE is required in production');
  if (!env.INTERNAL_PROXY_SECRET || isPlaceholder(env.INTERNAL_PROXY_SECRET))
    errors.push('INTERNAL_PROXY_SECRET is required in production');

  const broker = brokerPassword(env.RABBITMQ_URL ?? '');
  if (!broker || DEFAULT_BROKER_PASSWORDS.includes(broker) || isPlaceholder(broker)) {
    errors.push('RABBITMQ_URL still uses a default password');
  }
  for (const key of ['S3_ACCESS_KEY', 'S3_SECRET_KEY'] as const) {
    if (DEFAULT_STORAGE_KEYS.includes(env[key]) || isPlaceholder(env[key] ?? '')) errors.push(`${key} still has a default value`);
  }
  return errors;
}

function mailErrors(env: EnvironmentVariables): string[] {
  if (!env.MAIL_HOST) return [];
  const errors: string[] = [];
  if (!env.MAIL_FROM_EMAIL) errors.push('MAIL_FROM_EMAIL is required when MAIL_HOST is set');
  // Tests never reach a real SMTP server, whatever .env says
  if (env.NODE_ENV === 'test' && !LOOPBACK_HOSTS.includes(env.MAIL_HOST)) errors.push('MAIL_HOST must be local when NODE_ENV=test');
  return errors;
}

export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const env = plainToInstance(EnvironmentVariables, config, { enableImplicitConversion: true });
  const errors = validateSync(env, { skipMissingProperties: false }).flatMap((e) => Object.values(e.constraints ?? {}));
  if (Buffer.from(env.DB_CREDENTIALS_KEY ?? '', 'base64').length !== 32)
    errors.push('DB_CREDENTIALS_KEY must be 32 bytes encoded as base64');
  errors.push(...productionErrors(env), ...mailErrors(env));
  if (errors.length > 0) throw new Error(`Invalid environment:\n${errors.map((e) => ` - ${e}`).join('\n')}`);
  return env;
}
