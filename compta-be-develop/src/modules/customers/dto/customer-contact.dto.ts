import { IsBoolean, IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class CustomerContactDto {
  @IsOptional() @IsString() @MaxLength(100) firstName?: string;
  @IsString() @MaxLength(100) lastName: string;
  @IsOptional() @IsString() @MaxLength(100) jobTitle?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsOptional() @IsBoolean() isPrimary?: boolean;
}
