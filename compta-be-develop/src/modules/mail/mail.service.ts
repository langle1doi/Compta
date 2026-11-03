import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Transporter } from 'nodemailer';
import { decryptSecret, encryptSecret } from '../../common/crypto/secret-box';
import { ControlPrismaService } from '../../database/control-prisma.service';
import { MailJobStatus } from '../../generated/control/enums';
import { QueueName } from '../queue/queue-names';
import { NonRetryableError } from '../queue/queue-retry';
import { QueueService } from '../queue/queue.service';
import type { MailEnqueueResult, MailKind, OutgoingMail } from './mail.types';
import { createSmtpTransport } from './smtp-transport';

const SWEEP_INTERVAL_MS = 30_000;
const UNPUBLISHED_AFTER_MS = 5_000;

interface MailMessage {
  mailJobId: string;
}

/**
 * Transactional outbox: the rendered mail is stored encrypted in mail_jobs and RabbitMQ only carries the row id.
 * A link token therefore never reaches the broker, and a broker outage only delays sending.
 */
@Injectable()
export class MailService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MailService.name);
  private readonly key: string;
  private readonly transport?: Transporter;
  private readonly from?: { name: string; address: string };
  private sweeper?: NodeJS.Timeout;

  constructor(
    private readonly control: ControlPrismaService,
    private readonly queue: QueueService,
    config: ConfigService,
  ) {
    this.key = config.getOrThrow<string>('DB_CREDENTIALS_KEY');
    const host = config.get<string>('MAIL_HOST');
    if (host) {
      this.transport = createSmtpTransport({
        host,
        port: config.getOrThrow<number>('MAIL_PORT'),
        username: config.get<string>('MAIL_USERNAME'),
        password: config.get<string>('MAIL_PASSWORD'),
      });
      this.from = { name: config.getOrThrow<string>('MAIL_FROM_NAME'), address: config.getOrThrow<string>('MAIL_FROM_EMAIL') };
    }
  }

  get isConfigured() {
    return !!this.transport;
  }

  onModuleInit() {
    this.queue.registerConsumer(QueueName.MAIL, {
      handle: (message) => this.deliver(message as MailMessage),
      onDeadLetter: (message, error) => this.onDeadLetter(message as Partial<MailMessage> | undefined, error),
    });
    this.queue.onConnected(() => void this.publishPending());
  }

  /** Worker side: from here on, mails the broker missed are published again. */
  startSweeper() {
    this.sweeper ??= setInterval(() => void this.publishPending(), SWEEP_INTERVAL_MS).unref();
  }

  onModuleDestroy() {
    clearInterval(this.sweeper);
  }

  /** Never throws because of the broker. No SMTP configured: nothing is sent and the row says so. */
  async enqueue(kind: MailKind, tenantId: string | null, mail: OutgoingMail): Promise<MailEnqueueResult> {
    if (!this.transport) {
      const skipped = await this.control.mailJob.create({
        data: { kind, tenantId, status: MailJobStatus.SKIPPED, lastError: 'MAIL_NOT_CONFIGURED' },
      });
      this.logger.warn({ kind, mailJobId: skipped.id }, 'Mail skipped: MAIL_HOST is not configured');
      return { mailJobId: skipped.id, status: 'SKIPPED' };
    }
    const job = await this.control.mailJob.create({ data: { kind, tenantId, payloadEnc: encryptSecret(JSON.stringify(mail), this.key) } });
    await this.publish(job.id);
    return { mailJobId: job.id, status: 'QUEUED' };
  }

  /** Latest state of a mail, for job results and invitations. */
  async statusOf(mailJobId: string) {
    const job = await this.control.mailJob.findUnique({ where: { id: mailJobId }, select: { status: true, lastError: true } });
    return job ?? null;
  }

  /** Publishes rows the broker never got (it was down at enqueue time). A duplicate is harmless: the consumer checks the row. */
  async publishPending() {
    if (!this.queue.isConnected()) return;
    try {
      const rows = await this.control.mailJob.findMany({
        where: { status: MailJobStatus.QUEUED, publishedAt: null, createdAt: { lt: new Date(Date.now() - UNPUBLISHED_AFTER_MS) } },
        select: { id: true },
        take: 200,
      });
      for (const row of rows) await this.publish(row.id);
    } catch (error) {
      this.logger.warn({ errorCode: (error as { code?: string }).code }, 'Mail outbox sweep failed');
    }
  }

  private async publish(id: string) {
    try {
      await this.queue.publish(QueueName.MAIL, { mailJobId: id } satisfies MailMessage, id);
      await this.control.mailJob.update({ where: { id }, data: { publishedAt: new Date() } });
    } catch (error) {
      this.logger.warn({ mailJobId: id, reason: (error as Error).message }, 'Mail not published yet, the outbox will retry');
    }
  }

  /** Idempotent: a row that already ended is acknowledged without sending again. */
  private async deliver({ mailJobId }: MailMessage) {
    if (typeof mailJobId !== 'string') throw new NonRetryableError('Malformed mail message');
    const job = await this.control.mailJob.findUnique({ where: { id: mailJobId } });
    if (!job) throw new NonRetryableError('Unknown mail job');
    if (job.status !== MailJobStatus.QUEUED || !job.payloadEnc) return;
    if (!this.transport || !this.from) throw new Error('MAIL_HOST is not configured');

    let mail: OutgoingMail;
    try {
      mail = JSON.parse(decryptSecret(job.payloadEnc, this.key)) as OutgoingMail;
    } catch {
      throw new NonRetryableError('Mail payload cannot be decrypted');
    }
    await this.control.mailJob.update({ where: { id: job.id }, data: { attempts: { increment: 1 } } });
    try {
      // Object form on purpose: the address is not re-parsed as a header value
      await this.transport.sendMail({
        from: this.from,
        to: { name: '', address: mail.to },
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
      });
    } catch (error) {
      const code = sendErrorCode(error);
      await this.control.mailJob.update({ where: { id: job.id }, data: { lastError: code } });
      // The server's answer may quote addresses: the code is enough to diagnose
      this.logger.warn({ mailJobId: job.id, kind: job.kind, errorCode: code }, 'Mail could not be sent');
      if (isPermanentSmtpFailure(error)) throw new NonRetryableError(`SMTP failure ${code}`, { cause: error });
      throw new Error(`SMTP failure ${code}`, { cause: error });
    }
    await this.control.mailJob.update({
      where: { id: job.id },
      data: { status: MailJobStatus.SENT, sentAt: new Date(), payloadEnc: null, lastError: null },
    });
    this.logger.log({ mailJobId: job.id, kind: job.kind }, 'Mail sent');
  }

  private async onDeadLetter(message: Partial<MailMessage> | undefined, error: unknown) {
    const mailJobId = message?.mailJobId;
    if (typeof mailJobId !== 'string') return;
    await this.control.mailJob.updateMany({
      where: { id: mailJobId, status: MailJobStatus.QUEUED },
      data: { status: MailJobStatus.FAILED, payloadEnc: null, lastError: (error as Error).message.slice(0, 200) },
    });
  }
}

/** 5xx answers will not change on a retry (unknown mailbox, rejected sender); 4xx and network errors may. */
export function isPermanentSmtpFailure(error: unknown): boolean {
  const { responseCode } = error as { responseCode?: number };
  return typeof responseCode === 'number' && responseCode >= 500;
}

function sendErrorCode(error: unknown): string {
  const { code, responseCode } = error as { code?: string; responseCode?: number };
  return responseCode ? `SMTP_${responseCode}` : (code ?? 'SEND_FAILED');
}
