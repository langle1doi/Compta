import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { TokensModule } from './common/auth/access-token.service';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { IdempotencyInterceptor } from './common/http/idempotency.interceptor';
import { SnakeCaseResponseInterceptor } from './common/http/snake-case.interceptor';
import { AppThrottlerGuard, buildThrottlerOptions } from './common/http/throttle';
import { buildLoggerOptions } from './common/logging/logger.options';
import { EnvironmentVariables, validateEnv } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { AssistantModule } from './modules/assistant/assistant.module';
import { AuditInterceptor } from './modules/audit/audit.interceptor';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { JwtAuthGuard } from './modules/auth/jwt-auth.guard';
import { CompaniesModule } from './modules/companies/companies.module';
import { CustomersModule } from './modules/customers/customers.module';
import { HealthModule } from './modules/health/health.module';
import { MailModule } from './modules/mail/mail.module';
import { MetricsModule } from './modules/metrics/metrics.module';
import { NumberingModule } from './modules/numbering/numbering.module';
import { PlatformModule } from './modules/platform/platform.module';
import { PermissionGuard } from './modules/rbac/permission.guard';
import { QueueModule } from './modules/queue/queue.module';
import { RbacModule } from './modules/rbac/rbac.module';
import { StorageModule } from './modules/storage/storage.module';
import { TenancyModule } from './modules/tenancy/tenancy.module';
import { TenantSettingsModule } from './modules/tenant-settings/tenant-settings.module';
import { UsersModule } from './modules/users/users.module';

type AppConfig = ConfigService<EnvironmentVariables, true>;

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true, validate: validateEnv }),
    // First: its middleware assigns the request id before tenant resolution runs
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: AppConfig) =>
        buildLoggerOptions({ LOG_LEVEL: config.get('LOG_LEVEL', { infer: true }), LOG_PRETTY: config.get('LOG_PRETTY', { infer: true }) }),
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: AppConfig) =>
        buildThrottlerOptions({
          THROTTLE_DEFAULT_LIMIT: config.get('THROTTLE_DEFAULT_LIMIT', { infer: true }),
          THROTTLE_LOGIN_LIMIT: config.get('THROTTLE_LOGIN_LIMIT', { infer: true }),
          THROTTLE_LOGIN_EMAIL_LIMIT: config.get('THROTTLE_LOGIN_EMAIL_LIMIT', { infer: true }),
          THROTTLE_MFA_LIMIT: config.get('THROTTLE_MFA_LIMIT', { infer: true }),
        }),
    }),
    DatabaseModule,
    TokensModule,
    QueueModule,
    MailModule,
    StorageModule,
    AuditModule,
    MetricsModule,
    TenancyModule,
    AuthModule,
    RbacModule,
    NumberingModule,
    HealthModule,
    PlatformModule,
    TenantSettingsModule,
    CompaniesModule,
    UsersModule,
    CustomersModule,
    AssistantModule,
  ],
  providers: [
    // Order matters: rate limit, then authenticate, then authorize.
    { provide: APP_GUARD, useClass: AppThrottlerGuard },
    { provide: APP_GUARD, useExisting: JwtAuthGuard },
    { provide: APP_GUARD, useExisting: PermissionGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    // Order matters: a replayed request is answered before the audit interceptor would record it again.
    { provide: APP_INTERCEPTOR, useClass: SnakeCaseResponseInterceptor },
    { provide: APP_INTERCEPTOR, useClass: IdempotencyInterceptor },
    { provide: APP_INTERCEPTOR, useExisting: AuditInterceptor },
  ],
})
export class AppModule {}
