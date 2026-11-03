import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PlatformOnly, RequirePlatformPermission } from '../../../common/auth/auth.decorators';
import { CurrentActor, PlatformActor } from '../audit/platform-actor';
import { CreatePlatformUserDto, ListPlatformUsersQuery, UpdatePlatformUserDto, UpdatePlatformUserStatusDto } from './dto/platform-user.dto';
import { PlatformUsersService } from './platform-users.service';

@ApiTags('platform')
@ApiBearerAuth()
@PlatformOnly()
@Controller('platform/api/v1/users')
export class PlatformUsersController {
  constructor(private readonly users: PlatformUsersService) {}

  @Get()
  @RequirePlatformPermission('user', 'read')
  list(@Query() query: ListPlatformUsersQuery) {
    return this.users.list(query);
  }

  @Get(':id')
  @RequirePlatformPermission('user', 'read')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.users.get(id);
  }

  @Post()
  @RequirePlatformPermission('user', 'manage')
  create(@Body() dto: CreatePlatformUserDto, @CurrentActor() actor: PlatformActor) {
    return this.users.create(dto, actor);
  }

  @Patch(':id')
  @RequirePlatformPermission('user', 'manage')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePlatformUserDto, @CurrentActor() actor: PlatformActor) {
    return this.users.update(id, dto, actor);
  }

  @Patch(':id/status')
  @RequirePlatformPermission('user', 'manage')
  setStatus(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePlatformUserStatusDto, @CurrentActor() actor: PlatformActor) {
    return this.users.setStatus(id, dto.status, actor);
  }
}

@ApiTags('platform')
@ApiBearerAuth()
@PlatformOnly()
@Controller('platform/api/v1/roles')
export class PlatformRolesController {
  constructor(private readonly users: PlatformUsersService) {}

  @Get()
  @RequirePlatformPermission('role', 'read')
  list() {
    return this.users.listRoles();
  }
}
