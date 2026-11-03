import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PlatformOnly, RequirePlatformPermission } from '../../../common/auth/auth.decorators';
import { CurrentActor, PlatformActor } from '../audit/platform-actor';
import { ListMigrationsQuery } from './dto/list-migrations.query';
import { RunMigrationsDto } from './dto/run-migrations.dto';
import { MigrationsService } from './migrations.service';

@ApiTags('platform')
@ApiBearerAuth()
@PlatformOnly()
@Controller('platform/api/v1/migrations')
export class MigrationsController {
  constructor(private readonly migrations: MigrationsService) {}

  @Get()
  @RequirePlatformPermission('migration', 'read')
  status(@Query() query: ListMigrationsQuery) {
    return this.migrations.status(query);
  }

  /** No rollback through target_version: Prisma migrations only go forward. */
  @Post('run')
  @RequirePlatformPermission('migration', 'run')
  @HttpCode(HttpStatus.ACCEPTED)
  run(@Body() dto: RunMigrationsDto, @CurrentActor() actor: PlatformActor) {
    return this.migrations.start(dto.tenantIds, actor);
  }
}
