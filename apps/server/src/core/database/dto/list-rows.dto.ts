import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { FILTER_OPS, FilterOp } from '../utils/filter-ops';

export class RowFilterDto {
  // A property id (uuid) OR the Title pseudo-column sentinel (TITLE_FILTER_ID,
  // which is not a uuid). Validated as a string here; the service checks it
  // against the database's real properties (or the sentinel).
  @IsString()
  propertyId: string;

  @IsIn(FILTER_OPS as unknown as string[])
  op: FilterOp;

  // Raw comparison value (not the tagged {type,value} object). Omitted for
  // is_empty/is_not_empty. Shape is type-checked in the service.
  @IsOptional()
  value?: any;
}

export class RowSortDto {
  // See RowFilterDto.propertyId — also accepts the Title sentinel.
  @IsString()
  propertyId: string;

  @IsIn(['asc', 'desc'])
  direction: 'asc' | 'desc';
}

export class ListRowsDto {
  @IsUUID()
  databaseId: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RowFilterDto)
  filters?: RowFilterDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RowSortDto)
  sorts?: RowSortDto[];
}
