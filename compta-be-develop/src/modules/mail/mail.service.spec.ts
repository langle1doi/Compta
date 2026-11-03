import { ConfigService } from '@nestjs/config';
import { encryptSecret } from '../../common/crypto/secret-box';
import type { ControlPrismaService } from '../../database/control-prisma.service';
import { MailJobStatus } from '../../generated/control/enums';
import { NonRetryableError } from '../queue/queue-retry';
import type { QueueConsumer, QueueService } from '../queue/queue.service';
import { invitationMail } from './mail-templates';
import { isPermanentSmtpFailure, MailService } from './mail.service';
import { createSmtpTransport } from './smtp-transport';

jest.mock('./smtp-transport');

const KEY = Buffer.alloc(32, 7).toString('base64');
const SMTP_PASSWORD = 'smtp-secret-password';

describe('MailService delivery', () => {
  const sendMail = jest.fn();
  const job = {
    id: 'job-1',
    kind: 'invitation',
    status: MailJobStatus.QUEUED as MailJobStatus,
    payloadEnc: encryptSecret(JSON.stringify({ to: 'a@b.test', subject: 's', text: 't', html: 'h' }), KEY),
  };
  const update = jest.fn().mockResolvedValue(undefined);
  let consumer: QueueConsumer;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(createSmtpTransport).mockReturnValue({ sendMail } as never);
    const values: Record<string, unknown> = {
      DB_CREDENTIALS_KEY: KEY,
      MAIL_HOST: 'smtp.test',
      MAIL_PORT: 587,
      MAIL_PASSWORD: SMTP_PASSWORD,
      MAIL_FROM_NAME: 'COMPTA',
      MAIL_FROM_EMAIL: 'no-reply@compta.test',
    };
    const config = { get: (k: string) => values[k], getOrThrow: (k: string) => values[k] } as unknown as ConfigService;
    const control = { mailJob: { findUnique: jest.fn().mockResolvedValue(job), update } } as unknown as ControlPrismaService;
    const queue = { registerConsumer: (_: string, c: QueueConsumer) => (consumer = c), onConnected: jest.fn() } as unknown as QueueService;
    new MailService(control, queue, config).onModuleInit();
  });

  it('E-INF-03 a temporary SMTP failure is retried (plain error), recording only its code', async () => {
    sendMail.mockRejectedValue(Object.assign(new Error(`451 try later for a@b.test ${SMTP_PASSWORD}`), { responseCode: 451 }));
    const failure = await consumer.handle({ mailJobId: job.id }).catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(Error);
    expect(failure).not.toBeInstanceOf(NonRetryableError);
    expect((failure as Error).message).toBe('SMTP failure SMTP_451');
    expect(update).toHaveBeenCalledWith({ where: { id: job.id }, data: { lastError: 'SMTP_451' } });
    expect(JSON.stringify(update.mock.calls)).not.toContain(SMTP_PASSWORD);
  });

  it('E-INF-03 a permanent failure, like an address that does not exist, stops there', async () => {
    sendMail.mockRejectedValue(Object.assign(new Error('550 no such user'), { responseCode: 550 }));
    await expect(consumer.handle({ mailJobId: job.id })).rejects.toBeInstanceOf(NonRetryableError);
  });

  it('E-INF-03 no connection is temporary', () => {
    expect(isPermanentSmtpFailure(Object.assign(new Error('x'), { code: 'ECONNREFUSED' }))).toBe(false);
    expect(isPermanentSmtpFailure(Object.assign(new Error('x'), { responseCode: 421 }))).toBe(false);
    expect(isPermanentSmtpFailure(Object.assign(new Error('x'), { responseCode: 550 }))).toBe(true);
  });

  it('E-INF-04 the recipient is passed as an object, never parsed from text', async () => {
    sendMail.mockResolvedValue({});
    await consumer.handle({ mailJobId: job.id });
    expect(sendMail.mock.calls[0][0].to).toEqual({ name: '', address: 'a@b.test' });
  });
});

describe('mail templates', () => {
  it('E-INF-04 a name with a line break or HTML stays on one line and escaped', () => {
    const mail = invitationMail('Evil\r\nBcc: x@y.test <img src=x>', 'http://a.test/?token=1', new Date('2026-11-09T00:00:00Z'));
    expect(mail.subject).not.toMatch(/[\r\n]/);
    expect(mail.html).not.toContain('<img');
    expect(mail.html).toContain('&lt;img');
  });
});
