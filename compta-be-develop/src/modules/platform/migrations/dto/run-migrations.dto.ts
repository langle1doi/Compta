import { ArrayMaxSize, IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

export class RunMigrationsDto {
  /** Omitted: every tenant. An entry that is no tenant is skipped and reported, it does not fail the request (E-MIG-02). */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(1000)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  tenantIds?: string[];
}
