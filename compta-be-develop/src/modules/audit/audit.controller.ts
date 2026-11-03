import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Access, AccessContext, RequirePermission } from '../rbac/access';
import { AuditService } from './audit.service';
import { ListAuditLogsQuery } from './dto/list-audit-logs.query';

@ApiTags('audit')
@ApiBearerAuth()
@Controller('audit-logs')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @RequirePermission('audit', 'view')
  list(@Access() access: AccessContext, @Query() query: ListAuditLogsQuery) {
    return this.audit.list(access, query);
  }
}
