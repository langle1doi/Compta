import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { IsSiret } from '../../../common/validation/validators';
import { CustomerType, PaymentMethod } from '../../../generated/tenant/enums';
import { CustomerAddressDto } from './customer-address.dto';
import { CustomerContactDto } from './customer-contact.dto';

// The customer code is assigned by the server (F06 BR-02) and is not accepted here.
export class CreateCustomerDto {
  @IsEnum(CustomerType) type: CustomerType;
  /** Required for COMPANY; for INDIVIDUAL defaults to "firstName lastName" */
  @IsOptional() @IsString() @MaxLength(200) name?: string;
  @IsOptional() @IsString() @MaxLength(100) firstName?: string;
  @IsOptional() @IsString() @MaxLength(100) lastName?: string;
  @IsOptional() @IsString() @MaxLength(50) legalForm?: string;
  @IsOptional() @IsSiret() siret?: string;
  @IsOptional() @IsString() @MaxLength(20) vatNumber?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsOptional() @IsString() @MaxLength(200) website?: string;
  @IsOptional() @IsInt() @Min(0) @Max(365) paymentTermsDays?: number;
  @IsOptional() @IsEnum(PaymentMethod) paymentMethod?: PaymentMethod;
  @IsOptional() @IsUUID() defaultTaxRateId?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
  @IsOptional() @IsString() notes?: string;

  /** Defaults to the current user. Assigning to someone else needs COMPANY scope. */
  @IsOptional() @IsUUID() ownerId?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CustomerContactDto)
  contacts?: CustomerContactDto[];

  /** F06 BR-01: at least one BILLING address */
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CustomerAddressDto)
  addresses: CustomerAddressDto[];
}
