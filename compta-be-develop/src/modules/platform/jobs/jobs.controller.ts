import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PlatformOnly, RequirePlatformPermission } from '../../../common/auth/auth.decorators';
import { ListJobsQuery } from './dto/list-jobs.query';
import { JobsService } from './jobs.service';

@ApiTags('platform')
@ApiBearerAuth()
@PlatformOnly()
@Controller('platform/api/v1/jobs')
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  @Get()
  @RequirePlatformPermission('job', 'read')
  list(@Query() query: ListJobsQuery) {
    return this.jobs.list(query);
  }

  @Get(':id')
  @RequirePlatformPermission('job', 'read')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.jobs.get(id);
  }
}
