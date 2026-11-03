import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Params } from 'nestjs-pino';
import type { EnvironmentVariables } from '../../config/env.validation';
import type { RequestContext } from './request-context';

export const REQUEST_ID_HEADER = 'x-request-id';
const SAFE_REQUEST_ID = /^[A-Za-z0-9._-]{1,128}$/;

/** Never written to logs, wherever they appear in a logged object. */
export const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-api-key"]',
  'res.headers["set-cookie"]',
  'password',
  'adminPassword',
  'newPassword',
  'passwordHash',
  'mfaSecret',
  'dbPasswordEnc',
  'connectionString',
  'accessToken',
  'refreshToken',
  'mfaToken',
  'token',
  'tokenHash',
  'code',
  'mfaCode',
  '*.mfaCode',
  'body',
  'req.body',
  'secret',
  'totpSecretEnc',
  'recoveryCodes',
  'inviteUrl',
  'payloadEnc',
  'secretEnc',
  '*.refreshToken',
  '*.mfaToken',
  '*.token',
  '*.tokenHash',
  '*.secret',
  '*.totpSecretEnc',
  '*.recoveryCodes',
  '*.inviteUrl',
  '*.payloadEnc',
  '*.secretEnc',
  '*.password',
  '*.adminPassword',
  '*.newPassword',
  '*.passwordHash',
  '*.mfaSecret',
  '*.dbPasswordEnc',
  '*.connectionString',
  '*.accessToken',
];

type Req = IncomingMessage & RequestContext & { id?: string };

/** Link tokens travel in the path or the query of some routes: they must not reach the logs. */
export function safeUrl(url: string): string {
  return url
    .replace(/(\/invitations\/)[^/?#]+/g, '$1[REDACTED]')
    .replace(/([?&](?:token|refresh_token|mfa_token)=)[^&#]*/gi, '$1[REDACTED]');
}

export function buildLoggerOptions(env: Pick<EnvironmentVariables, 'LOG_LEVEL' | 'LOG_PRETTY'>): Params {
  return {
    pinoHttp: {
      level: env.LOG_LEVEL,
      transport: env.LOG_PRETTY ? { target: 'pino-pretty', options: { singleLine: true, translateTime: 'SYS:HH:MM:ss.l' } } : undefined,
      redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
      // Accept a well-formed incoming X-Request-Id (from the gateway), otherwise generate one; always echo it back.
      genReqId: (req: IncomingMessage, res: ServerResponse) => {
        const incoming = req.headers[REQUEST_ID_HEADER];
        const id = typeof incoming === 'string' && SAFE_REQUEST_ID.test(incoming) ? incoming : randomUUID();
        res.setHeader('X-Request-Id', id);
        return id;
      },
      customProps: (req: IncomingMessage) => {
        const r = req as Req;
        return {
          tenant: r.tenant?.subdomain,
          tenantId: r.tenant?.id,
          userId: r.user?.id,
          clientIp: r.clientIp,
          companyId: r.access?.companyId ?? undefined,
        };
      },
      customLogLevel: (_req, res, err) => (err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info'),
      autoLogging: { ignore: (req) => /^\/(health|metrics)/.test(req.url ?? '') },
      serializers: {
        req: (req: { id: string; method: string; url: string; remoteAddress?: string }) => ({
          id: req.id,
          method: req.method,
          url: safeUrl(req.url),
          remoteAddress: req.remoteAddress,
        }),
        res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
      },
    },
  };
}
