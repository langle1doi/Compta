import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/auth/auth.decorators';
import { AppException } from '../../common/errors/app.exception';
import { ErrorCode } from '../../common/errors/error-codes';
import { LoginThrottle } from '../../common/http/throttle';
import { Actor, AuditActor, NoAudit } from '../audit/audit.types';
import { AcceptInvitationDto } from '../auth/dto/auth-flows.dto';
import { TenantRegistryService } from '../tenancy/tenant-registry.service';
import { InvitationsService } from './invitations.service';

/** Whatever is wrong with a token (other tenant, unknown, expired), the answer is the same. */
const sameAnswer = (error: AppException) => {
  if (error.code === ErrorCode.INVALID_TOKEN)
    throw new AppException(HttpStatus.BAD_REQUEST, ErrorCode.INVITATION_INVALID, 'This invitation is invalid or has expired');
  throw error;
};

@ApiTags('auth')
@NoAudit()
@Public()
@Controller('auth/invitations')
export class InvitationsPublicController {
  constructor(
    private readonly invitations: InvitationsService,
    private readonly registry: TenantRegistryService,
  ) {}

  @LoginThrottle()
  @Get(':token')
  describe(@Param('token') token: string) {
    return this.registry.runForToken(token, () => this.invitations.describe(token)).catch(sameAnswer);
  }

  @LoginThrottle()
  @Post(':token/accept')
  @HttpCode(HttpStatus.OK)
  accept(@Param('token') token: string, @Body() dto: AcceptInvitationDto, @Actor() actor: AuditActor) {
    return this.registry.runForToken(token, () => this.invitations.accept(token, dto.password, actor)).catch(sameAnswer);
  }
}
