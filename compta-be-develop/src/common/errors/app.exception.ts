import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode, FieldError } from './error-codes';

/** Business error with a stable code. Rendered by AllExceptionsFilter. */
export class AppException extends HttpException {
  constructor(
    status: HttpStatus,
    readonly code: ErrorCode,
    message: string,
    readonly fields?: FieldError[],
  ) {
    super(message, status);
  }
}

export const validationError = (fields: FieldError[], message = 'Validation failed') =>
  new AppException(HttpStatus.UNPROCESSABLE_ENTITY, ErrorCode.VALIDATION_FAILED, message, fields);

export const fieldError = (field: string, code: string, message: string) => validationError([{ field, code, message }]);
