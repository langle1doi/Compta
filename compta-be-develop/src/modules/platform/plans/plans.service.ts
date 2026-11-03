import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { AppException } from '../../../common/errors/app.exception';
import { ErrorCode } from '../../../common/errors/error-codes';
import { ControlEventsService } from '../../../database/control-events.service';
import { ControlPrismaService } from '../../../database/control-prisma.service';
import { Prisma } from '../../../generated/control/client';
import type { PlatformActor } from '../audit/platform-actor';
import { PlatformAuditService } from '../audit/platform-audit.service';
import { CreatePlanDto, UpdatePlanDto } from './dto/plan.dto';

const planInUse = (message: string) => new AppException(HttpStatus.CONFLICT, ErrorCode.PLAN_IN_USE, message);
const codeTaken = () =>
  new AppException(HttpStatus.CONFLICT, ErrorCode.PLAN_CODE_TAKEN, 'Plan code already exists', [
    { field: 'code', code: ErrorCode.PLAN_CODE_TAKEN, message: 'Plan code already exists' },
  ]);

const knownError = (error: unknown, code: string) => error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;

@Injectable()
export class PlansService {
  constructor(
    private readonly control: ControlPrismaService,
    private readonly audit: PlatformAuditService,
    private readonly events: ControlEventsService,
  ) {}

  async list() {
    const plans = await this.control.plan.findMany({ orderBy: { createdAt: 'asc' }, include: { _count: { select: { tenants: true } } } });
    return plans.map(({ _count, ...plan }) => ({ ...plan, tenantCount: _count.tenants }));
  }

  async get(id: string) {
    const plan = await this.control.plan.findUnique({ where: { id }, include: { _count: { select: { tenants: true } } } });
    if (!plan) throw new NotFoundException('Plan not found');
    const { _count, ...rest } = plan;
    return { ...rest, tenantCount: _count.tenants };
  }

  async create(dto: CreatePlanDto, actor: PlatformActor) {
    try {
      return await this.control.$transaction(async (tx) => {
        const plan = await tx.plan.create({ data: dto });
        await this.audit.record(actor, { action: 'plan.create', targetType: 'plan', targetId: plan.id, after: plan }, tx);
        return plan;
      });
    } catch (error) {
      if (knownError(error, 'P2002')) throw codeTaken();
      throw error;
    }
  }

  async update(id: string, dto: UpdatePlanDto, actor: PlatformActor) {
    try {
      const updated = await this.control.$transaction(async (tx) => {
        const before = await tx.plan.findUnique({ where: { id } });
        if (!before) throw new NotFoundException('Plan not found');
        // E-TEN-13: tenants and integrations know a plan by its code
        if (dto.code && dto.code !== before.code && (await tx.tenant.count({ where: { planId: id } })) > 0) {
          throw planInUse('The code of a plan in use cannot change');
        }
        const after = await tx.plan.update({ where: { id }, data: dto });
        await this.audit.record(actor, { action: 'plan.update', targetType: 'plan', targetId: id, before, after }, tx);
        return after;
      });
      await this.events.publish({ kind: 'plan', planId: id });
      return updated;
    } catch (error) {
      if (knownError(error, 'P2002')) throw codeTaken();
      throw error;
    }
  }

  async remove(id: string, actor: PlatformActor) {
    try {
      await this.control.$transaction(async (tx) => {
        const before = await tx.plan.findUnique({ where: { id } });
        if (!before) throw new NotFoundException('Plan not found');
        await tx.plan.delete({ where: { id } });
        await this.audit.record(actor, { action: 'plan.delete', targetType: 'plan', targetId: id, before }, tx);
      });
      await this.events.publish({ kind: 'plan', planId: id });
    } catch (error) {
      // The foreign key decides, so a tenant created at the same moment cannot lose its plan
      if (knownError(error, 'P2003')) throw planInUse('A plan in use cannot be deleted');
      throw error;
    }
  }
}
