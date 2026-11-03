import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';

export class AssistantMessageDto {
  @IsIn(['user', 'assistant'])
  role: 'user' | 'assistant';

  @IsString()
  @MaxLength(8000)
  content: string;
}

export class AssistantChatDto {
  /** The whole conversation so far; the last message is the user's question. */
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => AssistantMessageDto)
  messages: AssistantMessageDto[];

  @IsOptional()
  @IsIn(['fr', 'en'])
  locale?: 'fr' | 'en';
}
