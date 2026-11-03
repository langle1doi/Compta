import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { generateTenantToken, hashOpaqueToken } from '../../common/crypto/opaque-token';
import { AppException } from '../../common/errors/app.exception';
import { ErrorCode } from '../../common/errors/error-codes';
import { tenantPublicUrl } from '../../common/http/public-url';
import type { Prisma } from '../../generated/tenant/client';
import { CompanyStatus, UserStatus } from '../../generated/tenant/enums';
import { AuditService } from '../audit/audit.service';
import type { AuditActor } from '../audit/audit.types';
import { hashPassword } from '../auth/password';
import { UserStateService } from '../auth/user-state.service';
import { invitationMail } from '../mail/mail-templates';
import { MailService } from '../mail/mail.service';
import { EnforcerService } from '../rbac/enforcer.service';
import { PlanLimitsService } from '../tenancy/plan-limits.service';
import { TenantDbService } from '../tenancy/tenant-db.service';
import { InviteUserDto } from './dto/invite-user.dto';
import { USER_SELECT, UsersService } from './users.service';

// F04 A
const INVITATION_DAYS = 7;

const invalidInvitation = () =>
  new AppException(HttpStatus.BAD_REQUEST, ErrorCode.INVITATION_INVALID, 'This invitation is invalid or has expired');

export interface SentInvitation {
  mailStatus: 'QUEUED' | 'SKIPPED';
  /** Only when no mail server is configured: someone must hand the link over. */
  inviteUrl?: string;
  expiresAt: Date;
}

@Injectable()
export class InvitationsService {
  private readonly urlTemplate?: string;

  constructor(
    private readonly tenantDb: TenantDbService,
    private readonly users: UsersService,
    private readonly planLimits: PlanLimitsService,
    private readonly mail: MailService,
    private readonly audit: AuditService,
    private readonly enforcers: EnforcerService,
    private readonly userState: UserStateService,
    config: ConfigService,
  ) {
    this.urlTemplate = config.get<string>('APP_PUBLIC_URL_TEMPLATE');
  }

  /** F04 AC-01. The invited user holds a seat from now on (E-INV-03). */
  async invite(dto: InviteUserDto, actor: AuditActor) {
    await this.users.assertMembershipsValid(dto.memberships);
    const db = this.tenantDb.client;
    if (await db.user.findUnique({ where: { email: dto.email }, select: { id: true } })) {
      throw new AppException(HttpStatus.UNPROCESSABLE_ENTITY, ErrorCode.EMAIL_TAKEN, 'A user with this email already exists', [
        { field: 'email', code: ErrorCode.EMAIL_TAKEN, message: 'A user with this email already exists' },
      ]);
    }
    await this.planLimits.assertCanAdd('users');

    const user = await db.user.create({
      data: {
        email: dto.email,
        fullName: dto.fullName,
        locale: dto.locale,
        status: UserStatus.INVITED,
        memberships: { create: dto.memberships.map((m) => ({ companyId: m.companyId ?? null, roleId: m.roleId })) },
      },
      select: USER_SELECT,
    });
    const sent = await this.send(user.id, user.email, actor.userId ?? null);
    await this.audit.recordSafe(actor, { action: 'user.invite', entity: 'user', entityId: user.id, after: user });
    return { user, ...sent };
  }

  /** The previous link stops working (BE-F04-04). */
  async resend(userId: string, actor: AuditActor) {
    const user = await this.pending(userId);
    const sent = await this.send(user.id, user.email, actor.userId ?? null);
    await this.audit.recordSafe(actor, { action: 'user.invite_resent', entity: 'user', entityId: user.id });
    return sent;
  }

  /** E-INV-09: the link dies and the seat is freed. */
  async cancel(userId: string, actor: AuditActor) {
    const user = await this.pending(userId);
    await this.tenantDb.client.$transaction(async (tx) => {
      await tx.invitation.updateMany({ where: { userId, acceptedAt: null, revokedAt: null }, data: { revokedAt: new Date() } });
      await tx.user.update({ where: { id: user.id }, data: { status: UserStatus.DISABLED } });
      await this.audit.record(actor, { action: 'user.invite_cancelled', entity: 'user', entityId: userId }, tx);
    });
  }

  /** A GET must not consume the token: mail scanners open links (E-FE-11). */
  async describe(token: string) {
    const invitation = await this.valid(token, this.tenantDb.client);
    const { email, fullName } = invitation.user;
    const companyNames = await this.companyNames(invitation.userId);
    return { email, fullName, companyName: companyNames.join(', ') || null, companyNames, expiresAt: invitation.expiresAt };
  }

  /** One use: of two parallel requests only one gets the row (E-INV-01). */
  async accept(token: string, password: string, actor: AuditActor) {
    const db = this.tenantDb.client;
    // Public route: a wrong token must not cost a password hash
    const invitation = await this.valid(token, db);
    // E-INV-03: a downgrade since the invitation can leave no seat for this user
    await this.planLimits.assertUsersWithinPlan();

    const passwordHash = await hashPassword(password);
    const userId = invitation.userId;
    await db.$transaction(async (tx) => {
      const { count } = await tx.invitation.updateMany({
        where: { id: invitation.id, acceptedAt: null, revokedAt: null },
        data: { acceptedAt: new Date() },
      });
      if (count !== 1) throw invalidInvitation();
      await tx.user.update({ where: { id: userId }, data: { passwordHash, status: UserStatus.ACTIVE } });
      await this.audit.record({ ...actor, type: 'user', userId }, { action: 'user.invite_accepted', entity: 'user', entityId: userId }, tx);
    });
    await this.userState.changed(this.tenantDb.tenantId, userId);
    await this.enforcers.policyChanged(this.tenantDb.tenantId);

    // E-INV-02: a company switched off since the invitation is reported, and stays closed (COMPANY_INACTIVE)
    const memberships = await db.membership.findMany({
      where: { userId },
      select: { companyId: true, company: { select: { status: true } } },
    });
    const unavailable = memberships.filter((m) => m.company && m.company.status !== CompanyStatus.ACTIVE).map((m) => m.companyId);
    return { email: invitation.user.email, status: UserStatus.ACTIVE, unavailableCompanyIds: unavailable };
  }

  private async valid(token: string, db: Prisma.TransactionClient) {
    const invitation = await db.invitation.findUnique({
      where: { tokenHash: hashOpaqueToken(token) },
      include: { user: { select: { email: true, fullName: true, status: true } } },
    });
    if (
      !invitation ||
      invitation.acceptedAt ||
      invitation.revokedAt ||
      invitation.expiresAt <= new Date() ||
      invitation.user.status !== UserStatus.INVITED
    ) {
      throw invalidInvitation();
    }
    return invitation;
  }

  /** F04 AC-01: the companies this person is invited to. A tenant-wide role means all of them. Switched-off ones are not offered. */
  private async companyNames(userId: string): Promise<string[]> {
    const db = this.tenantDb.client;
    const tenantWide = await db.membership.findFirst({ where: { userId, companyId: null }, select: { userId: true } });
    const companies = await db.company.findMany({
      where: { status: CompanyStatus.ACTIVE, ...(!tenantWide && { memberships: { some: { userId } } }) },
      orderBy: { createdAt: 'asc' },
      select: { legalName: true },
    });
    return companies.map((c) => c.legalName);
  }

  /** E-INV-05: an existing account is never re-invited, its password stays. */
  private async pending(userId: string) {
    const user = await this.tenantDb.client.user.findUnique({ where: { id: userId }, select: { id: true, email: true, status: true } });
    if (!user) throw new NotFoundException('User not found');
    if (user.status !== UserStatus.INVITED)
      throw new AppException(HttpStatus.CONFLICT, ErrorCode.NO_PENDING_INVITE, 'This user has no pending invitation');
    return user;
  }

  /** Also used when provisioning the first admin of a tenant. */
  async send(userId: string, email: string, invitedById: string | null): Promise<SentInvitation> {
    const { tenantId, subdomain } = this.tenantDb.context;
    const token = generateTenantToken(tenantId);
    const expiresAt = new Date(Date.now() + INVITATION_DAYS * 86_400_000);
    const db = this.tenantDb.client;
    await db.$transaction([
      db.invitation.updateMany({ where: { userId, acceptedAt: null, revokedAt: null }, data: { revokedAt: new Date() } }),
      db.invitation.create({ data: { userId, tokenHash: hashOpaqueToken(token), expiresAt, invitedById } }),
    ]);

    const url = tenantPublicUrl(this.urlTemplate, subdomain, `/accept-invitation?token=${encodeURIComponent(token)}`);
    const companyNames = await this.companyNames(userId);
    const { status } = await this.mail.enqueue('invitation', tenantId, {
      to: email,
      ...invitationMail(companyNames.join(', ') || subdomain, url, expiresAt),
    });
    return { mailStatus: status, expiresAt, ...(status === 'SKIPPED' && { inviteUrl: url }) };
  }
}
