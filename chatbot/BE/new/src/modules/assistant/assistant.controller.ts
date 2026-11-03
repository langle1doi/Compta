import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { NoAudit } from '../audit/audit.types';
import { Access, AccessContext, RequirePermission } from '../rbac/access';
import { AssistantChatDto } from './assistant.dto';
import { AssistantService } from './assistant.service';

@ApiTags('assistant')
@ApiBearerAuth()
@Controller('assistant')
export class AssistantController {
  constructor(private readonly assistant: AssistantService) {}

  @NoAudit()
  @Post('chat')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('dashboard', 'view')
  chat(@Access() access: AccessContext, @Body() dto: AssistantChatDto) {
    return this.assistant.chat(access, dto);
  }
}
