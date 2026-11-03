import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';

@Module({
  controllers: [MetricsController],
  providers: [MetricsService],
})
export class MetricsModule implements NestModule {
  constructor(private readonly metrics: MetricsService) {}

  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply((req: Request, res: Response, next: NextFunction) => {
        const start = process.hrtime.bigint();
        res.on('finish', () => {
          const route = (req.route as { path?: string } | undefined)?.path ?? 'unmatched';
          if (route !== '/metrics') this.metrics.observe(req.method, route, res.statusCode, Number(process.hrtime.bigint() - start) / 1e9);
        });
        next();
      })
      .forRoutes('{*splat}');
  }
}
