import { IsIn } from 'class-validator';
import { UserStatus } from '../../../generated/tenant/enums';

const SETTABLE = [UserStatus.ACTIVE, UserStatus.DISABLED] as const;

export class UpdateUserStatusDto {
  /** DISABLED revokes every session immediately (F04 AC-04) */
  @IsIn(SETTABLE)
  status: (typeof SETTABLE)[number];
}
