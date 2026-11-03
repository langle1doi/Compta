import { Injectable } from '@nestjs/common';
import type { Enforcer } from 'casbin';
import { ControlEventsService } from '../../database/control-events.service';
import type { TenantPrismaClient } from '../../database/tenant-prisma.manager';
import { DataScope } from '../../generated/tenant/enums';
import { createEnforcer } from './casbin/create-enforcer';
import { PrismaPolicyAdapter } from './casbin/prisma-policy.adapter';
import { companyDomain, SCOPES_WIDEST_FIRST, userSubject } from './casbin/subjects';

// Safety net if a NOTIFY is missed (listener reconnecting); normally invalidated immediately.
const MAX_POLICY_AGE_MS = 5 * 60 * 1000;

interface CachedEnforcer {
  enforcer: Promise<Enforcer>;
  loadedAt: number;
}

/** One Casbin enforcer per tenant, policies loaded from that tenant's DB. */
@Injectable()
export class EnforcerService {
  private readonly enforcers = new Map<string, CachedEnforcer>();

  constructor(private readonly events: ControlEventsService) {
    events.subscribe((event) => {
      if (event.kind === 'policy' || event.kind === 'user' || event.kind === 'tenant') this.enforcers.delete(event.tenantId);
    });
  }

  forTenant(tenantId: string, db: TenantPrismaClient): Promise<Enforcer> {
    const cached = this.enforcers.get(tenantId);
    if (cached && Date.now() - cached.loadedAt < MAX_POLICY_AGE_MS) return cached.enforcer;

    const enforcer = createEnforcer(new PrismaPolicyAdapter(db));
    this.enforcers.set(tenantId, { enforcer, loadedAt: Date.now() });
    enforcer.catch(() => this.enforcers.delete(tenantId));
    return enforcer;
  }

  /** Call after any committed change to roles, role_permissions or memberships: reloads on every instance. */
  async policyChanged(tenantId: string) {
    await this.events.publish({ kind: 'policy', tenantId });
  }

  /** Widest data scope the user has for (resource, action) in the company, or null if denied. */
  async resolveScope(
    enforcer: Enforcer,
    userId: string,
    companyId: string | null,
    resource: string,
    action: string,
  ): Promise<DataScope | null> {
    for (const scope of SCOPES_WIDEST_FIRST) {
      if (await enforcer.enforce(userSubject(userId), companyDomain(companyId), resource, action, scope)) return scope;
    }
    return null;
  }
}
