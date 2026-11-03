import { timingSafeEqual } from 'node:crypto';
import { Controller, Get, Headers, NotFoundException, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { Public } from '../../common/auth/auth.decorators';
import { MetricsService } from './metrics.service';

const same = (sent: string, expected: string) => {
  const a = Buffer.from(sent);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
};

/** Not public: without METRICS_TOKEN configured, or with the wrong one, the route does not exist. */
@ApiExcludeController()
@Public()
@SkipThrottle()
@Controller('metrics')
export class MetricsController {
  private readonly token?: string;

  constructor(
    private readonly metrics: MetricsService,
    config: ConfigService,
  ) {
    this.token = config.get<string>('METRICS_TOKEN');
  }

  @Get()
  async scrape(@Headers('authorization') authorization: string | undefined, @Res() res: Response) {
    if (!this.token || !same(authorization ?? '', `Bearer ${this.token}`)) throw new NotFoundException();
    res.type(this.metrics.registry.contentType).send(await this.metrics.registry.metrics());
  }
}
