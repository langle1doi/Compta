import { CallHandler, ExecutionContext, HttpStatus, Injectable, NestInterceptor, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { from, mergeMap, Observable, of, tap } from 'rxjs';
import { Prisma } from '../../generated/tenant/client';
import { currentTenant } from '../../modules/tenancy/tenant-context';
import { AppException, validationError } from '../errors/app.exception';
import { ErrorCode } from '../errors/error-codes';
import type { RequestContext } from '../logging/request-context';

const IDEMPOTENT = 'http:idempotent';
const KEY_PATTERN = /^[\w.:-]{8,128}$/;
const KEEP_MS = 24 * 60 * 60 * 1000;

/**
 * E-API-06, for creates without a natural unique key (customers). With an Idempotency-Key header, the same key by the
 * same user on the same route answers the first result instead of creating twice. Other creates are protected by
 * their unique key: tenant subdomain, user email, role key, plan code. Without the header nothing changes.
 */
export const Idempotent = () => SetMetadata(IDEMPOTENT, true);

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (!this.reflector.get<boolean>(IDEMPOTENT, ctx.getHandler())) return next.handle();
    const req = ctx.switchToHttp().getRequest<Request & RequestContext>();
    const key = req.header('idempotency-key');
    const tenant = currentTenant();
    if (!key || !tenant || !req.user) return next.handle();
    if (!KEY_PATTERN.test(key))
      throw validationError([
        { field: 'Idempotency-Key', code: 'invalid', message: 'Idempotency-Key must be 8-128 characters of letters, digits, . _ : -' },
      ]);

    const id = { key, userId: req.user.id, route: `${req.method} ${req.route?.path}` };
    const { db } = tenant;
    return from(
      (async () => {
        await db.idempotencyKey.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - KEEP_MS) } } });
        try {
          await db.idempotencyKey.create({ data: id });
          return { first: true as const };
        } catch (error) {
          if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;
          const row = await db.idempotencyKey.findUnique({ where: { key_userId_route: id } });
          if (row?.response === null || row?.response === undefined) {
            throw new AppException(
              HttpStatus.CONFLICT,
              ErrorCode.IDEMPOTENCY_IN_PROGRESS,
              'The first request with this key is still running',
            );
          }
          return { first: false as const, response: row.response };
        }
      })(),
    ).pipe(
      mergeMap((state) => {
        if (!state.first) return of(state.response);
        return next.handle().pipe(
          tap({
            next: (response: unknown) => {
              db.idempotencyKey
                .update({
                  where: { key_userId_route: id },
                  data: { response: JSON.parse(JSON.stringify(response)) as Prisma.InputJsonValue },
                })
                .catch(() => undefined);
            },
            // A failed attempt changed nothing: the same key may try again
            error: () => {
              db.idempotencyKey.deleteMany({ where: id }).catch(() => undefined);
            },
          }),
        );
      }),
    );
  }
}
