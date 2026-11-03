import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Prisma } from '../../generated/tenant/client';
import { AppException } from '../errors/app.exception';
import { ErrorCode, ErrorResponseBody, FieldError } from '../errors/error-codes';
import { toSnake, toSnakePath } from '../http/case-conversion';
import { captureServerError } from '../observability/sentry';

const CODE_BY_STATUS: Partial<Record<number, ErrorCode>> = {
  400: ErrorCode.BAD_REQUEST,
  401: ErrorCode.UNAUTHORIZED,
  403: ErrorCode.FORBIDDEN,
  404: ErrorCode.NOT_FOUND,
  409: ErrorCode.CONFLICT,
  422: ErrorCode.VALIDATION_FAILED,
  423: ErrorCode.ACCOUNT_LOCKED,
  429: ErrorCode.RATE_LIMITED,
};

const PRISMA_ERRORS: Record<string, { status: HttpStatus; code: ErrorCode; message: string }> = {
  P2002: { status: HttpStatus.CONFLICT, code: ErrorCode.UNIQUE_VIOLATION, message: 'A record with these values already exists' },
  P2003: {
    status: HttpStatus.CONFLICT,
    code: ErrorCode.FOREIGN_KEY_VIOLATION,
    message: 'Record is referenced by or references missing data',
  },
  P2025: { status: HttpStatus.NOT_FOUND, code: ErrorCode.NOT_FOUND, message: 'Record not found' },
};

/**
 * Single error format for the whole API, snake_case like every response:
 * { status_code, code, message, fields?: [{ field, code, message }], request_id }.
 * Never leaks stack traces, SQL or Prisma internals; 5xx are logged with the request id.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request & { id?: string }>();
    const res = ctx.getResponse<Response & { err?: Error }>();
    const body = this.toBody(exception);
    body.requestId = req.id;

    if (body.statusCode >= 500) {
      // pino-http attaches res.err to the request log line
      res.err = exception as Error;
      this.logger.error({ err: exception, requestId: req.id }, 'Unhandled error');
      captureServerError(exception, req.id);
    }
    if (res.headersSent) return;
    res.status(body.statusCode).json({
      status_code: body.statusCode,
      code: body.code,
      message: body.message,
      ...(body.fields && { fields: body.fields.map(snakeField) }),
      request_id: body.requestId,
    });
  }

  private toBody(exception: unknown): ErrorResponseBody {
    if (exception instanceof AppException) {
      return { statusCode: exception.getStatus(), code: exception.code, message: exception.message, fields: exception.fields };
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      const message =
        typeof response === 'string'
          ? response
          : typeof (response as { message?: unknown }).message === 'string'
            ? (response as { message: string }).message
            : exception.message;
      return {
        statusCode: status,
        code: CODE_BY_STATUS[status] ?? (status >= 500 ? ErrorCode.INTERNAL_ERROR : ErrorCode.BAD_REQUEST),
        message,
      };
    }
    const parser = bodyParserError(exception);
    if (parser) return parser;
    if (isDatabaseUnavailable(exception)) {
      return {
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        code: ErrorCode.DB_UNAVAILABLE,
        message: 'The database is not available, try again shortly',
      };
    }
    // Both generated Prisma clients share this runtime error class
    if (exception instanceof Prisma.PrismaClientKnownRequestError && PRISMA_ERRORS[exception.code]) {
      const { status, code, message } = PRISMA_ERRORS[exception.code];
      return { statusCode: status, code, message };
    }
    return { statusCode: HttpStatus.INTERNAL_SERVER_ERROR, code: ErrorCode.INTERNAL_ERROR, message: 'Internal server error' };
  }
}

/** Thrown by the JSON body parser before Nest sees the request (E-API-04). */
function bodyParserError(exception: unknown): ErrorResponseBody | null {
  const { type, status } = exception as { type?: unknown; status?: unknown };
  if (typeof type !== 'string' || typeof status !== 'number') return null;
  if (type === 'entity.too.large')
    return { statusCode: HttpStatus.PAYLOAD_TOO_LARGE, code: ErrorCode.PAYLOAD_TOO_LARGE, message: 'Request body is too large' };
  if (status >= 400 && status < 500)
    return { statusCode: HttpStatus.BAD_REQUEST, code: ErrorCode.BAD_REQUEST, message: 'Request body could not be read' };
  return null;
}

const CONNECTION_ERRORS = new Set([
  'P1000',
  'P1001',
  'P1002',
  'P1003',
  'P1008',
  'P1017',
  'P2024',
  'P2037',
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  '53300',
  '57P01',
  '57P03',
]);
const CONNECTION_ERROR_KINDS = new Set([
  'TooManyConnections',
  'DatabaseNotReachable',
  'DatabaseDoesNotExist',
  'AuthenticationFailed',
  'ConnectionClosed',
  'SocketTimeout',
]);

/** E-INF-06: out of connections or database down is a clear, retryable answer, and says nothing about the connection. */
function isDatabaseUnavailable(exception: unknown): boolean {
  if (exception instanceof Prisma.PrismaClientInitializationError) return true;
  const { code, cause, meta } = exception as {
    code?: unknown;
    cause?: { code?: unknown };
    meta?: { driverAdapterError?: { cause?: { kind?: unknown } } };
  };
  const kind = meta?.driverAdapterError?.cause?.kind;
  return (
    (typeof code === 'string' && CONNECTION_ERRORS.has(code)) ||
    (typeof cause?.code === 'string' && CONNECTION_ERRORS.has(cause.code)) ||
    (typeof kind === 'string' && CONNECTION_ERROR_KINDS.has(kind))
  );
}

/** DTO property names are camelCase; the client only knows their snake_case form. */
function snakeField(error: FieldError): FieldError {
  // Rejected camelCase keys are reported exactly as the client sent them
  if (error.code === 'snakeCase') return error;
  const property = error.field.split('.').pop() ?? '';
  const message = property ? error.message.replace(new RegExp(`\\b${property}\\b`, 'g'), toSnake(property)) : error.message;
  return { ...error, field: toSnakePath(error.field), message };
}
