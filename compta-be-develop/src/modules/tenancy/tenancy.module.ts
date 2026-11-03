import { Global, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { PlanLimitsService } from './plan-limits.service';
import { TenantDbService } from './tenant-db.service';
import { TenantRegistryService } from './tenant-registry.service';
import { TenantResolverMiddleware } from './tenant-resolver.middleware';

@Global()
@Module({
  providers: [TenantRegistryService, TenantDbService, PlanLimitsService],
  exports: [TenantRegistryService, TenantDbService, PlanLimitsService],
})
export class TenancyModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantResolverMiddleware).exclude('health/{*splat}', 'metrics').forRoutes('{*splat}');
  }
}
