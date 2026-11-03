import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailService } from '../modules/mail/mail.service';
import { TenantExportsService } from '../modules/platform/exports/tenant-exports.service';
import { TenantPurgeService } from '../modules/platform/exports/tenant-purge.service';
import { JobsService } from '../modules/platform/jobs/jobs.service';
import { TenantUsageService } from '../modules/platform/tenants/tenant-usage.service';
import { QueueService } from '../modules/queue/queue.service';

/**
 * Background side of an API process. Consumers registered with QueueService.registerConsumer (onModuleInit) start here.
 * WORKER_ENABLED=false keeps a replica HTTP only.
 */
export async function startWorkers(app: INestApplication) {
  if (!app.get(ConfigService).get<boolean>('WORKER_ENABLED')) return;
  await app.get(QueueService).startConsumers();
  app.get(MailService).startSweeper();
  app.get(TenantUsageService).startSchedule();
  app.get(JobsService).startSweeper();
  app.get(TenantPurgeService).startSchedule();
  app.get(TenantExportsService).startSweeper();
}
