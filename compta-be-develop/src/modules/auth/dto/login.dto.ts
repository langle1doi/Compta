import { IsString, MaxLength, MinLength } from 'class-validator';
import { NormalizedEmail } from '../../../common/validation/validators';

export class LoginDto {
  @NormalizedEmail()
  email: string;

  // The limit comes first: nothing long ever reaches Argon2 (E-AUTH-02)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  password: string;
}
