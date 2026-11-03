import { IsBoolean, IsEnum, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { AddressType } from '../../../generated/tenant/enums';

export class CustomerAddressDto {
  @IsEnum(AddressType) type: AddressType;
  @IsOptional() @IsString() @MaxLength(100) label?: string;
  @IsString() @MaxLength(200) line1: string;
  @IsOptional() @IsString() @MaxLength(200) line2?: string;
  @IsString() @MaxLength(20) postalCode: string;
  @IsString() @MaxLength(100) city: string;
  @IsOptional() @IsString() @MaxLength(100) state?: string;
  @IsOptional() @Length(2, 2) countryCode?: string;
  @IsOptional() @IsBoolean() isDefault?: boolean;
}
