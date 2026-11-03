import { createServer, Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { Writable } from 'node:stream';
import pino from 'pino';
import pinoHttp, { Options } from 'pino-http';
import { buildLoggerOptions } from './logger.options';

const SECRETS = [
  'Top-Secret-Password',
  'eyJhbGciOi.access.token',
  'refresh-token-value',
  'invitation-token-value',
  'reset-token-value',
  '654321',
  'db-password-value',
];

describe('BE-INF-11 JSON log lines', () => {
  let server: Server;
  let lines: string[];
  let base: string;

  beforeAll(async () => {
    lines = [];
    const stream = new Writable({
      write(chunk: Buffer, _enc, done) {
        lines.push(chunk.toString());
        done();
      },
    });
    const { pinoHttp: options } = buildLoggerOptions({ LOG_LEVEL: 'info', LOG_PRETTY: false }) as { pinoHttp: Options };
    const logger = pino(options as pino.LoggerOptions, stream);
    const http = pinoHttp({ ...options, logger } as Options);
    server = createServer((req, res) => {
      http(req, res);
      req.log.info(
        {
          password: SECRETS[0],
          refreshToken: SECRETS[2],
          mfaCode: SECRETS[5],
          body: { newPassword: SECRETS[0], code: SECRETS[5] },
          connectionString: `postgresql://u:${SECRETS[6]}@host/db`,
        },
        'handling',
      );
      res.end('ok');
    });
    await new Promise<void>((r) => server.listen(0, r));
    base = `http://localhost:${(server.address() as AddressInfo).port}`;
    await fetch(`${base}/api/v1/auth/invitations/${SECRETS[3]}`, {
      headers: { Authorization: `Bearer ${SECRETS[1]}`, Cookie: `refresh=${SECRETS[2]}` },
    });
    await fetch(`${base}/reset-password?token=${SECRETS[4]}`);
    await new Promise((r) => setTimeout(r, 50));
  });
  afterAll(() => new Promise((r) => server.close(r)));

  it('holds no password, token, connection string or 2FA code', () => {
    expect(lines.length).toBeGreaterThan(0);
    const text = lines.join('');
    for (const secret of SECRETS) expect(text).not.toContain(secret);
  });

  it('is JSON and carries a request id', () => {
    const parsed = lines.map((l) => JSON.parse(l) as { req?: { id?: unknown }; level: unknown });
    expect(parsed.some((l) => l.req?.id !== undefined)).toBe(true);
  });
});
