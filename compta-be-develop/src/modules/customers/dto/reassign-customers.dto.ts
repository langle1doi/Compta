import { ArrayMaxSize, IsArray, IsOptional, IsUUID } from 'class-validator';

export class ReassignCustomersDto {
  @IsUUID()
  fromUserId: string;

  @IsUUID()
  toUserId: string;

  /** Omitted: every customer of from_user_id in reach. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5000)
  @IsUUID(undefined, { each: true })
  customerIds?: string[];
}
