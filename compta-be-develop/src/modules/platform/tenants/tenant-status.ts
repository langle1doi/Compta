import { HttpStatus } from '@nestjs/common';
import { AppException } from '../../../common/errors/app.exception';
import { ErrorCode } from '../../../common/errors/error-codes';
import { TenantStatus } from '../../../generated/control/enums';

const { PROVISIONING, ACTIVE, SUSPENDED, FAILED, DELETED } = TenantStatus;

/** F01 BR-03: PROVISIONING -> ACTIVE <-> SUSPENDED -> DELETED; PROVISIONING -> FAILED -> PROVISIONING. */
export const TENANT_TRANSITIONS: Record<TenantStatus, readonly TenantStatus[]> = {
  [PROVISIONING]: [ACTIVE, FAILED],
  [ACTIVE]: [SUSPENDED],
  [SUSPENDED]: [ACTIVE, DELETED],
  [FAILED]: [PROVISIONING],
  [DELETED]: [],
};

export function canTransition(from: TenantStatus, to: TenantStatus): boolean {
  return TENANT_TRANSITIONS[from].includes(to);
}

export function assertTransition(from: TenantStatus, to: TenantStatus) {
  if (!canTransition(from, to)) {
    throw new AppException(HttpStatus.CONFLICT, ErrorCode.INVALID_STATUS_TRANSITION, `Tenant cannot go from ${from} to ${to}`);
  }
}
