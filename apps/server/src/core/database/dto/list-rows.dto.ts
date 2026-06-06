import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsOptional,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { FILTER_OPS, FilterOp } from '../utils/filter-ops';

export class RowFilterDto {
  @IsUUID()
  propertyId: string;

  @IsIn(FILTER_OPS as unknown as string[])
  op: FilterOp;

  // Raw comparison value (not the tagged {type,value} object). Omitted for
  // is_empty/is_not_empty. Shape is type-checked in the service.
  @IsOptional()
  value?: any;
}

export class RowSortDto {
  @IsUUID()
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
