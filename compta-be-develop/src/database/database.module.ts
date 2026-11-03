import { Global, Module } from '@nestjs/common';
import { ControlEventsService } from './control-events.service';
import { ControlPrismaService } from './control-prisma.service';
import { TenantPrismaManager } from './tenant-prisma.manager';

@Global()
@Module({
  providers: [ControlPrismaService, TenantPrismaManager, ControlEventsService],
  exports: [ControlPrismaService, TenantPrismaManager, ControlEventsService],
})
export class DatabaseModule {}
