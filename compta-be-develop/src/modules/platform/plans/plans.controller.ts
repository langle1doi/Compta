import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PlatformOnly, RequirePlatformPermission } from '../../../common/auth/auth.decorators';
import { CurrentActor, PlatformActor } from '../audit/platform-actor';
import { CreatePlanDto, UpdatePlanDto } from './dto/plan.dto';
import { PlansService } from './plans.service';

@ApiTags('platform')
@ApiBearerAuth()
@PlatformOnly()
@Controller('platform/api/v1/plans')
export class PlansController {
  constructor(private readonly plans: PlansService) {}

  @Get()
  @RequirePlatformPermission('plan', 'read')
  list() {
    return this.plans.list();
  }

  @Get(':id')
  @RequirePlatformPermission('plan', 'read')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.plans.get(id);
  }

  @Post()
  @RequirePlatformPermission('plan', 'manage')
  create(@Body() dto: CreatePlanDto, @CurrentActor() actor: PlatformActor) {
    return this.plans.create(dto, actor);
  }

  @Patch(':id')
  @RequirePlatformPermission('plan', 'manage')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePlanDto, @CurrentActor() actor: PlatformActor) {
    return this.plans.update(id, dto, actor);
  }

  @Delete(':id')
  @RequirePlatformPermission('plan', 'manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentActor() actor: PlatformActor) {
    return this.plans.remove(id, actor);
  }
}
