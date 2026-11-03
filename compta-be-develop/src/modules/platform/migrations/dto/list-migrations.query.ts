import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

/** Query strings carry text: anything but these two stays as it is, for @IsBoolean to refuse. */
function parseBoolean(value: unknown): unknown {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
}

export class ListMigrationsQuery {
  /** true: only the tenants behind the latest version */
  @IsOptional()
  @Transform(({ obj }: { obj: { outdated?: unknown } }) => parseBoolean(obj.outdated))
  @IsBoolean()
  outdated?: boolean;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20;
}
