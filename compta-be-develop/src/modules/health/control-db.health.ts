import { Injectable } from '@nestjs/common';
import { HealthIndicatorService } from '@nestjs/terminus';
import { ControlPrismaService } from '../../database/control-prisma.service';

const TIMEOUT_MS = 2_000;

@Injectable()
export class ControlDbHealthIndicator {
  constructor(
    private readonly control: ControlPrismaService,
    private readonly indicator: HealthIndicatorService,
  ) {}

  async check(key = 'controlDb') {
    const session = this.indicator.check(key);
    try {
      await Promise.race([
        this.control.$queryRaw`SELECT 1`,
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS).unref()),
      ]);
      return session.up();
    } catch (error) {
      // Message only: never expose connection details
      return session.down({ message: (error as Error).message === 'timeout' ? 'timeout' : 'unreachable' });
    }
  }
}
