import { IsUUID } from 'class-validator';

export class ShareCustomerDto {
  @IsUUID()
  userId: string;
}
