import { Controller, Get, HttpStatus, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../../common/auth/auth.decorators';
import { AppException } from '../../common/errors/app.exception';
import { ErrorCode } from '../../common/errors/error-codes';
import { QueueService } from '../queue/queue.service';
import { StorageService } from '../storage/storage.service';
import { ControlDbHealthIndicator } from './control-db.health';

const stateOf = (up: boolean) => (up ? 'up' : 'down');

/** Kubernetes/ECS probes. Outside the /api/v1 prefix and tenant resolution. */
@ApiTags('health')
@Public()
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly controlDb: ControlDbHealthIndicator,
    private readonly queue: QueueService,
    private readonly storage: StorageService,
  ) {}

  /** Process is up (no dependency checks). */
  @Get('live')
  @HealthCheck()
  live() {
    return this.health.check([]);
  }

  /**
   * 503 only without the control DB: nothing works then. Broker or storage down must not take every pod out of the load
   * balancer, since login and most features still work (mail waits in its outbox): 200, "degraded", with what is down.
   * Alerts come from the logs and the broker_connected and storage_reachable metrics.
   */
  @Get('ready')
  @HealthCheck()
  async ready() {
    try {
      await this.health.check([() => this.controlDb.check()]);
    } catch (error) {
      if (!(error instanceof ServiceUnavailableException)) throw error;
      throw new AppException(HttpStatus.SERVICE_UNAVAILABLE, ErrorCode.NOT_READY, 'Not ready: control_db');
    }
    const broker = this.queue.isConnected();
    const storage = this.storage.isAvailable();
    return {
      status: broker && storage ? 'ok' : 'degraded',
      components: { controlDb: 'up', broker: stateOf(broker), storage: stateOf(storage) },
    };
  }
}
