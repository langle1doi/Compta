import { HttpStatus, Injectable } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception';
import { ErrorCode } from '../../common/errors/error-codes';
import type { TenantPrismaClient } from '../../database/tenant-prisma.manager';
import { currentTenant, TenantContextValue } from './tenant-context';

/** Inject this in feature services to reach the current request's tenant database. */
@Injectable()
export class TenantDbService {
  get context(): TenantContextValue {
    const ctx = currentTenant();
    if (!ctx) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.TENANT_CONTEXT_REQUIRED,
        'This endpoint must be called on a tenant subdomain',
      );
    }
    return ctx;
  }

  get client(): TenantPrismaClient {
    return this.context.db;
  }

  get tenantId(): string {
    return this.context.tenantId;
  }
}
