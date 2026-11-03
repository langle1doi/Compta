import { IsOptional } from 'class-validator';
import { IsStrongPassword } from '../../../../common/validation/validators';

/** Passwords are never stored with the provisioning input. Omitted: the first admin is invited by email. */
export class RetryProvisioningDto {
  @IsOptional()
  @IsStrongPassword()
  adminPassword?: string;
}
