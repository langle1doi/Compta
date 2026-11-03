import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppException } from '../../common/errors/app.exception';
import { ErrorCode } from '../../common/errors/error-codes';
import { EnvironmentVariables } from '../../config/env.validation';
import type { AccessContext } from '../rbac/access';
import { TenantDbService } from '../tenancy/tenant-db.service';
import { BusinessData, formatContext, loadBusinessData } from './assistant-context';
import { localReply } from './assistant-local';
import { AssistantChatDto } from './assistant.dto';

const SYSTEM_PROMPT = (locale: string) =>
  `You are COMPTA Assistant, the in-app helper of an invoicing and accounting web application (customers, quotes, invoices, payments, reports). ` +
  `Answer concisely in ${locale === 'en' ? 'English' : 'French'}. Use plain text with "•" bullets, no markdown headings. ` +
  `Answer only from the data below; never invent figures, invoices or customers. If the data does not cover the question, say so.\n\n`;

@Injectable()
export class AssistantService {
  private readonly logger = new Logger(AssistantService.name);

  constructor(
    private readonly config: ConfigService<EnvironmentVariables, true>,
    private readonly tenantDb: TenantDbService,
  ) {}

  /** OpenAI when OPENAI_API_KEY is set; keyword matching on the same data when it is not, or when OpenAI fails. */
  async chat(access: AccessContext, dto: AssistantChatDto): Promise<{ reply: string; source: 'openai' | 'local' }> {
    const last = dto.messages[dto.messages.length - 1];
    if (last.role !== 'user') {
      throw new AppException(HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_FAILED, 'The last message must come from the user');
    }
    const data = await loadBusinessData(this.tenantDb.client, access);

    const apiKey = this.config.get('OPENAI_API_KEY', { infer: true });
    if (apiKey) {
      try {
        return { reply: await this.askOpenAi(apiKey, dto, data), source: 'openai' };
      } catch (error) {
        this.logger.warn(`OpenAI failed, answering locally: ${(error as Error).message}`);
      }
    }
    return { reply: localReply(last.content, data, dto.locale ?? 'fr'), source: 'local' };
  }

  private async askOpenAi(apiKey: string, dto: AssistantChatDto, data: BusinessData): Promise<string> {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: this.config.get('ASSISTANT_MODEL', { infer: true }),
        max_tokens: 1024,
        messages: [{ role: 'system', content: SYSTEM_PROMPT(dto.locale ?? 'fr') + formatContext(data) }, ...dto.messages],
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const body = (await res.json()) as { choices?: { message?: { content?: string | null } }[] };
    const reply = (body.choices?.[0]?.message?.content ?? '').trim();
    if (!reply) throw new Error('empty reply');
    return reply;
  }
}
