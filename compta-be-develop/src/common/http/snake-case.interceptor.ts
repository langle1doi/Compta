import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { map, Observable } from 'rxjs';
import { keysToSnake } from './case-conversion';

/** Every JSON response body leaves in snake_case (errors are handled by AllExceptionsFilter). */
@Injectable()
export class SnakeCaseResponseInterceptor implements NestInterceptor {
  intercept(_ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map((data) => keysToSnake(data)));
  }
}
