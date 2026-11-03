import { timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import type { RequestContext } from '../logging/request-context';

/** Who is calling, for sessions and audit. */
export interface ClientInfo {
  ip?: string;
  userAgent?: string;
}

export const USER_AGENT_MAX_LENGTH = 500;
export const CLIENT_IP_HEADER = 'x-client-ip';
export const PROXY_SECRET_HEADER = 'x-internal-proxy-secret';

function secretsMatch(sent: string, expected: string): boolean {
  const a = Buffer.from(sent);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * The frontend proxy is the only client allowed to state the caller's address, and proves it with a shared secret.
 * Anything else (a spoofed header, X-Forwarded-For) is ignored: the socket address counts.
 */
export function resolveClientIp(headers: Record<string, unknown>, socketAddress: string | undefined, secret: string | undefined): string {
  const fallback = socketAddress ?? 'unknown';
  const sent = headers[PROXY_SECRET_HEADER];
  const ip = headers[CLIENT_IP_HEADER];
  if (!secret || typeof sent !== 'string' || typeof ip !== 'string') return fallback;
  return secretsMatch(sent, secret) && isIP(ip) ? ip : fallback;
}

export function clientIpMiddleware(secret: string | undefined) {
  return (req: Request & RequestContext, _res: Response, next: NextFunction) => {
    req.clientIp = resolveClientIp(req.headers, req.socket.remoteAddress, secret);
    next();
  };
}

export const clientInfoOf = (req: Request & RequestContext): ClientInfo => ({
  ip: req.clientIp ?? req.socket?.remoteAddress,
  userAgent: req.header('user-agent')?.slice(0, USER_AGENT_MAX_LENGTH),
});

export const Client = createParamDecorator((_: unknown, ctx: ExecutionContext): ClientInfo =>
  clientInfoOf(ctx.switchToHttp().getRequest()),
);
