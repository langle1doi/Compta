import { ArgumentMetadata, Injectable, PipeTransform } from '@nestjs/common';
import { validationError } from '../errors/app.exception';
import { keysToCamel, nonSnakeKeys } from './case-conversion';

/** Paths of strings containing a NUL byte: PostgreSQL cannot store them, and they have no legitimate use. */
export function nulStrings(value: unknown, parent = ''): string[] {
  if (typeof value === 'string') return value.includes('\u0000') ? [parent || 'value'] : [];
  if (Array.isArray(value)) return value.flatMap((v, i) => nulStrings(v, parent ? `${parent}.${i}` : String(i)));
  if (value === null || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([k, v]) => nulStrings(v, parent ? `${parent}.${k}` : k));
}

/**
 * First global pipe: request body and query arrive in snake_case and are handed to the
 * DTOs (and ValidationPipe) in camelCase. camelCase keys from the client are rejected (422).
 * A handler declaring a plain Object body validates it itself and gets it untouched.
 */
@Injectable()
export class SnakeCaseRequestPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata) {
    if (metadata.type !== 'body' && metadata.type !== 'query') return value;
    if (metadata.metatype === Object) return value;
    const withNul = nulStrings(value);
    if (withNul.length > 0) {
      throw validationError(withNul.map((field) => ({ field, code: 'nulByte', message: `${field} contains an invalid character` })));
    }
    const invalid = nonSnakeKeys(value);
    if (invalid.length > 0) {
      throw validationError(invalid.map((field) => ({ field, code: 'snakeCase', message: `${field} must be written in snake_case` })));
    }
    return keysToCamel(value);
  }
}
