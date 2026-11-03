import { TenantStatus } from '../../../generated/control/enums';
import { assertTransition, canTransition } from './tenant-status';

const { PROVISIONING, ACTIVE, SUSPENDED, FAILED, DELETED } = TenantStatus;

describe('tenant lifecycle (F01 BR-03)', () => {
  it.each([
    [PROVISIONING, ACTIVE],
    [PROVISIONING, FAILED],
    [ACTIVE, SUSPENDED],
    [SUSPENDED, ACTIVE],
    [SUSPENDED, DELETED],
    [FAILED, PROVISIONING],
  ])('allows %s -> %s', (from, to) => expect(canTransition(from, to)).toBe(true));

  it.each([
    [DELETED, ACTIVE],
    [ACTIVE, DELETED],
    [FAILED, ACTIVE],
    [ACTIVE, PROVISIONING],
    [PROVISIONING, SUSPENDED],
    [ACTIVE, ACTIVE],
  ])('rejects %s -> %s with 409', (from, to) => {
    expect(canTransition(from, to)).toBe(false);
    expect(() => assertTransition(from, to)).toThrow(expect.objectContaining({ code: 'INVALID_STATUS_TRANSITION', status: 409 }));
  });
});
