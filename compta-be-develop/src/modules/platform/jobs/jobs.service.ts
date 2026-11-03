import { Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ADVISORY_LOCKS, withAdvisoryLock } from '../../../database/advisory-lock';
import { ControlPrismaService } from '../../../database/control-prisma.service';
import { Prisma, ProvisioningJob } from '../../../generated/control/client';
import { ProvisioningJobStatus, ProvisioningJobType } from '../../../generated/control/enums';
import { QueueName } from '../../queue/queue-names';
import { NonRetryableError } from '../../queue/queue-retry';
import { QueueService } from '../../queue/queue.service';
import type { ListJobsQuery } from './dto/list-jobs.query';

const { QUEUED, RUNNING, SUCCEEDED, FAILED } = ProvisioningJobStatus;

const QUEUE_OF: Record<ProvisioningJobType, QueueName> = {
  [ProvisioningJobType.PROVISION]: QueueName.PROVISIONING,
  [ProvisioningJobType.MIGRATE]: QueueName.MIGRATION,
  [ProvisioningJobType.EXPORT]: QueueName.EXPORT,
};

// A job updates its row at every step and every tenant: this long without an update means its process died.
const JOB_STALE_MS = 30 * 60 * 1000;
const SWEEP_EVERY_MS = 60 * 1000;
// Above the fixed locks of ADVISORY_LOCKS
const JOB_LOCK_BASE = 10_000_000_000;

export interface JobStep {
  step: string;
  status: 'RUNNING' | 'DONE' | 'FAILED' | 'SKIPPED';
  at: string;
}

/** The fields a client may see: never secret_enc. */
export const JOB_PUBLIC_FIELDS = {
  id: true,
  type: true,
  tenantId: true,
  status: true,
  step: true,
  steps: true,
  result: true,
  attempt: true,
  createdAt: true,
  startedAt: true,
  finishedAt: true,
  updatedAt: true,
} satisfies Prisma.ProvisioningJobSelect;

export const parseJobMessage = (message: unknown): string => {
  const jobId = (message as { jobId?: unknown } | null)?.jobId;
  if (typeof jobId !== 'string' || !/^[0-9a-f-]{36}$/i.test(jobId)) throw new NonRetryableError('Malformed job message');
  return jobId;
};

/**
 * Background work of the platform. The row holds the state and is committed first; RabbitMQ only carries its id, so a broker
 * that is down loses nothing: unpublished rows go out on reconnect and from the sweeper (outbox).
 */
@Injectable()
export class JobsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(JobsService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly control: ControlPrismaService,
    private readonly queue: QueueService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    this.queue.onConnected(() => void this.publishPending());
  }

  onModuleDestroy() {
    clearInterval(this.timer);
  }

  startSweeper() {
    this.timer ??= setInterval(() => void this.sweep(), SWEEP_EVERY_MS).unref();
  }

  async publish(job: Pick<ProvisioningJob, 'id' | 'type'>) {
    try {
      await this.queue.publish(QUEUE_OF[job.type], { jobId: job.id }, job.id);
      await this.control.provisioningJob.update({ where: { id: job.id }, data: { publishedAt: new Date() } });
    } catch (error) {
      this.logger.warn({ jobId: job.id, reason: (error as Error).message }, 'Job not published yet, the sweeper will send it');
    }
  }

  async publishPending() {
    try {
      const pending = await this.control.provisioningJob.findMany({
        where: { status: QUEUED, publishedAt: null },
        select: { id: true, type: true },
      });
      for (const job of pending) await this.publish(job);
    } catch (error) {
      this.logger.warn({ code: (error as { code?: string }).code }, 'Could not publish pending jobs');
    }
  }

  /** Never throws: it runs from a timer. */
  async sweep() {
    try {
      await withAdvisoryLock(this.config.getOrThrow<string>('CONTROL_DATABASE_URL'), ADVISORY_LOCKS.JOB_SWEEP, async () => {
        await this.publishPending();
        await this.failStale();
      });
    } catch (error) {
      this.logger.warn({ code: (error as { code?: string }).code }, 'Job sweep did not run');
    }
  }

  /** E-MIG-05: a job whose process died or whose message never came back does not stay active forever. Provisioning has its own rule. */
  async failStale(now = new Date()) {
    const { count } = await this.control.provisioningJob.updateMany({
      where: {
        type: { not: ProvisioningJobType.PROVISION },
        status: { in: [QUEUED, RUNNING] },
        updatedAt: { lt: new Date(now.getTime() - JOB_STALE_MS) },
      },
      data: { status: FAILED, finishedAt: now, secretEnc: null, result: { reason: 'interrupted: the job did not finish' } },
    });
    if (count > 0) this.logger.warn({ count }, 'Marked interrupted jobs as failed');
  }

  /**
   * Runs `fn` unless another delivery of this job is running: the same message can arrive twice (broker redelivery, sweeper).
   * The lock dies with the process, so a redelivery after a crash does run.
   */
  async runExclusive(jobId: string, fn: () => Promise<void>) {
    const key = JOB_LOCK_BASE + parseInt(jobId.slice(0, 8), 16);
    const { ran } = await withAdvisoryLock(this.config.getOrThrow<string>('CONTROL_DATABASE_URL'), key, fn);
    if (!ran) this.logger.warn({ jobId }, 'Job already running elsewhere, skipping this delivery');
  }

  /** Claims a delivery: false when the job already ended, so a late redelivery does nothing (E-TEN-07). */
  async begin(jobId: string): Promise<ProvisioningJob | null> {
    const now = new Date();
    const { count } = await this.control.provisioningJob.updateMany({
      where: { id: jobId, status: { in: [QUEUED, RUNNING] } },
      data: { status: RUNNING, attempt: { increment: 1 }, startedAt: now, step: null, steps: [] },
    });
    return count === 0 ? null : this.control.provisioningJob.findUniqueOrThrow({ where: { id: jobId } });
  }

  async step(jobId: string, step: string, status: JobStep['status'] = 'RUNNING') {
    const job = await this.control.provisioningJob.findUniqueOrThrow({ where: { id: jobId }, select: { steps: true } });
    const steps = [
      ...((job.steps ?? []) as unknown as JobStep[]).filter((s) => s.step !== step),
      { step, status, at: new Date().toISOString() },
    ];
    await this.control.provisioningJob.update({ where: { id: jobId }, data: { step, steps: steps as unknown as Prisma.InputJsonValue } });
  }

  /** Progress of a long job; also proves it is alive. */
  async progress(jobId: string, result: object) {
    await this.control.provisioningJob.update({ where: { id: jobId }, data: { result: result as Prisma.InputJsonValue } });
  }

  /** A long step proves it is alive, so the stale rule does not fail it. */
  async touch(jobId: string) {
    await this.control.provisioningJob.update({ where: { id: jobId }, data: { updatedAt: new Date() } });
  }

  async succeed(jobId: string, result?: object) {
    await this.finish(jobId, SUCCEEDED, result);
  }

  async fail(jobId: string, result: object) {
    await this.finish(jobId, FAILED, result);
  }

  private async finish(jobId: string, status: ProvisioningJobStatus, result?: object) {
    await this.control.provisioningJob.updateMany({
      where: { id: jobId, status: { in: [QUEUED, RUNNING] } },
      data: { status, finishedAt: new Date(), secretEnc: null, ...(result && { result: result as Prisma.InputJsonValue }) },
    });
  }

  async get(id: string) {
    const job = await this.control.provisioningJob.findUnique({ where: { id }, select: JOB_PUBLIC_FIELDS });
    if (!job) throw new NotFoundException('Job not found');
    return job;
  }

  async list(query: ListJobsQuery) {
    const where: Prisma.ProvisioningJobWhereInput = { type: query.type, status: query.status, tenantId: query.tenantId };
    const [items, total] = await Promise.all([
      this.control.provisioningJob.findMany({
        where,
        select: JOB_PUBLIC_FIELDS,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.control.provisioningJob.count({ where }),
    ]);
    return { items, total, page: query.page, pageSize: query.pageSize };
  }
}
