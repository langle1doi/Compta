import { ValidationError, ValidationPipe } from '@nestjs/common';
import { validationError } from '../errors/app.exception';
import { FieldError } from '../errors/error-codes';

function flatten(errors: ValidationError[], parent = ''): FieldError[] {
  return errors.flatMap((error) => {
    const field = parent ? `${parent}.${error.property}` : error.property;
    const own = Object.entries(error.constraints ?? {}).map(([code, message]) => ({ field, code, message }));
    return [...own, ...flatten(error.children ?? [], field)];
  });
}

/** Global pipe: strips unknown props, rejects them, and answers 422 with per-field errors (PRD F-state "Validation Error"). */
export function createValidationPipe() {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: (errors) => validationError(flatten(errors)),
  });
}
