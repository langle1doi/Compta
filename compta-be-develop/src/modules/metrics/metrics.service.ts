import { Injectable, OnModuleInit } from '@nestjs/common';
import { collectDefaultMetrics, Counter, Gauge, Histogram, Registry } from 'prom-client';
import { QueueService } from '../queue/queue.service';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class MetricsService implements OnModuleInit {
  readonly registry = new Registry();
  private readonly duration = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration',
    labelNames: ['method', 'route', 'status'] as const,
    buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [this.registry],
  });
  private readonly errors = new Counter({
    name: 'http_server_errors_total',
    help: 'Responses with a 5xx status',
    labelNames: ['route'] as const,
    registers: [this.registry],
  });

  constructor(
    private readonly queue: QueueService,
    private readonly storage: StorageService,
  ) {}

  onModuleInit() {
    collectDefaultMetrics({ register: this.registry });
    const queue = this.queue;
    this.registry.registerMetric(
      new Gauge({
        name: 'broker_connected',
        help: '1 while the API is connected to RabbitMQ',
        registers: [],
        collect() {
          this.set(queue.isConnected() ? 1 : 0);
        },
      }),
    );
    const storage = this.storage;
    this.registry.registerMetric(
      new Gauge({
        name: 'storage_reachable',
        help: '1 while the API can reach object storage',
        registers: [],
        collect() {
          this.set(storage.isAvailable() ? 1 : 0);
        },
      }),
    );
  }

  /** The route pattern, never the URL: paths hold ids and invitation tokens. */
  observe(method: string, route: string, status: number, seconds: number) {
    this.duration.observe({ method, route, status: String(status) }, seconds);
    if (status >= 500) this.errors.inc({ route });
  }
}
