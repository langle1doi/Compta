import { Global, Module } from '@nestjs/common';
import { EnforcerService } from './enforcer.service';
import { PermissionGuard } from './permission.guard';
import { PlatformEnforcerService } from './platform-enforcer.service';
import { RolesController } from './roles.controller';
import { RolesService } from './roles.service';

// PermissionGuard is registered globally in AppModule, right after JwtAuthGuard.
@Global()
@Module({
  controllers: [RolesController],
  providers: [EnforcerService, PlatformEnforcerService, RolesService, PermissionGuard],
  exports: [EnforcerService, PlatformEnforcerService, PermissionGuard],
})
export class RbacModule {}
