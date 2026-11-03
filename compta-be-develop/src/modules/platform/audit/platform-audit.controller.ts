import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PlatformOnly, RequirePlatformPermission } from '../../../common/auth/auth.decorators';
import { ListPlatformAuditLogsQuery } from './dto/list-platform-audit-logs.query';
import { PlatformAuditService } from './platform-audit.service';

@ApiTags('platform')
@ApiBearerAuth()
@PlatformOnly()
@Controller('platform/api/v1/audit-logs')
export class PlatformAuditController {
  constructor(private readonly audit: PlatformAuditService) {}

  @Get()
  @RequirePlatformPermission('audit', 'read')
  list(@Query() query: ListPlatformAuditLogsQuery) {
    return this.audit.list(query);
  }
}
