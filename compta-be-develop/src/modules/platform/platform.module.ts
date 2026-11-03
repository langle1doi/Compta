import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { UsersModule } from '../users/users.module';
import { PlatformAuditController } from './audit/platform-audit.controller';
import { PlatformAuditService } from './audit/platform-audit.service';
import { PlatformAuthController } from './auth/platform-auth.controller';
import { PlatformAuthService } from './auth/platform-auth.service';
import { DefaultCredentialsService } from './default-credentials.service';
import { PlatformTenantExportsController, TenantExportsController } from './exports/tenant-exports.controller';
import { TenantExportsService } from './exports/tenant-exports.service';
import { TenantPurgeService } from './exports/tenant-purge.service';
import { JobsController } from './jobs/jobs.controller';
import { JobsService } from './jobs/jobs.service';
import { MigrationsController } from './migrations/migrations.controller';
import { MigrationsService } from './migrations/migrations.service';
import { PlansController } from './plans/plans.controller';
import { PlansService } from './plans/plans.service';
import { SupportAuditInterceptor } from './support/support-audit.interceptor';
import { PlatformSupportSessionsController, SupportSessionsController } from './support/support-sessions.controller';
import { SupportSessionsService } from './support/support-sessions.service';
import { TenantProvisioningService } from './tenants/tenant-provisioning.service';
import { TenantUsageService } from './tenants/tenant-usage.service';
import { TenantProvisionerService } from './tenants/tenant-provisioner.service';
import { TenantsController } from './tenants/tenants.controller';
import { TenantsService } from './tenants/tenants.service';
import { PlatformRolesController, PlatformUsersController } from './users/platform-users.controller';
import { PlatformUsersService } from './users/platform-users.service';

@Module({
  imports: [UsersModule],
  controllers: [
    PlatformAuthController,
    PlatformAuditController,
    PlatformUsersController,
    PlatformRolesController,
    PlansController,
    JobsController,
    MigrationsController,
    PlatformTenantExportsController,
    TenantExportsController,
    PlatformSupportSessionsController,
    SupportSessionsController,
    TenantsController,
  ],
  providers: [
    PlatformAuthService,
    PlatformAuditService,
    PlatformUsersService,
    TenantsService,
    TenantProvisionerService,
    TenantUsageService,
    PlansService,
    JobsService,
    TenantProvisioningService,
    MigrationsService,
    TenantExportsService,
    TenantPurgeService,
    SupportSessionsService,
    { provide: APP_INTERCEPTOR, useClass: SupportAuditInterceptor },
    DefaultCredentialsService,
  ],
  // Used by the CLI (src/cli) through an application context, and by unified login
  exports: [
    JobsService,
    TenantPurgeService,
    TenantExportsService,
    TenantsService,
    DefaultCredentialsService,
    PlatformAuthService,
    PlatformAuditService,
    TenantUsageService,
  ],
})
export class PlatformModule {}
