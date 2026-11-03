import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/control/client';

/** Client for the control plane DB (tenants, plans, platform admins). */
@Injectable()
export class ControlPrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(config: ConfigService) {
    super({ adapter: new PrismaPg({ connectionString: config.getOrThrow<string>('CONTROL_DATABASE_URL') }) });
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
