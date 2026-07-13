import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class PageIdDto {
  @IsUUID()
  pageId: string;
}

export class CreateBaseDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsUUID()
  pageId?: string;

  @IsUUID()
  spaceId: string;

  @IsOptional()
  @IsIn(['kanban'])
  template?: 'kanban';
}

export class UpdateBaseDto {
  @IsUUID()
  pageId: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  icon?: string;
}

export class ConvertBaseDto {
  @IsUUID()
  pageId: string;

  @IsOptional()
  @IsIn(['kanban'])
  template?: 'kanban';
}

export class ListBasesDto {
  @IsUUID()
  spaceId: string;

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  limit?: number;
}

export class ExpandPagesDto {
  @IsArray()
  @IsUUID(undefined, { each: true })
  pageIds: string[];
}

export class CreatePropertyDto {
  @IsUUID()
  pageId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @IsString()
  type: string;

  @IsOptional()
  @IsObject()
  typeOptions?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  requestId?: string;
}

export class UpdatePropertyDto {
  @IsString()
  propertyId: string;

  @IsUUID()
  pageId: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsObject()
  typeOptions?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  requestId?: string;
}

export class DeletePropertyDto {
  @IsString()
  propertyId: string;

  @IsUUID()
  pageId: string;

  @IsOptional()
  @IsString()
  requestId?: string;
}

export class ReorderPropertyDto {
  @IsString()
  propertyId: string;

  @IsUUID()
  pageId: string;

  @IsString()
  @IsNotEmpty()
  position: string;

  @IsOptional()
  @IsString()
  requestId?: string;
}

export class CreateRowDto {
  @IsUUID()
  pageId: string;

  @IsOptional()
  @IsObject()
  cells?: Record<string, unknown>;

  @IsOptional()
  @IsUUID()
  afterRowId?: string;

  @IsOptional()
  @IsString()
  position?: string;

  // Fork: apply a base template's cell preset
  @IsOptional()
  @IsUUID()
  templateId?: string;

  @IsOptional()
  @IsString()
  requestId?: string;
}

export class RowInfoDto {
  @IsUUID()
  rowId: string;

  @IsUUID()
  pageId: string;
}

export class UpdateRowDto {
  @IsUUID()
  rowId: string;

  @IsUUID()
  pageId: string;

  @IsObject()
  cells: Record<string, unknown>;

  @IsOptional()
  @IsString()
  position?: string;

  @IsOptional()
  @IsString()
  requestId?: string;
}

export class DeleteRowDto {
  @IsUUID()
  rowId: string;

  @IsUUID()
  pageId: string;

  @IsOptional()
  @IsString()
  requestId?: string;
}

export class DeleteRowsDto {
  @IsUUID()
  pageId: string;

  @IsArray()
  @IsUUID(undefined, { each: true })
  rowIds: string[];

  @IsOptional()
  @IsString()
  requestId?: string;
}

export class ListRowsDto {
  @IsUUID()
  pageId: string;

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  limit?: number;

  // FilterNode tree; validated structurally by the filter engine.
  @IsOptional()
  @IsObject()
  filter?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  sorts?: Array<{ propertyId: string; direction: 'asc' | 'desc' }>;
}

export class ReorderRowDto {
  @IsUUID()
  rowId: string;

  @IsUUID()
  pageId: string;

  @IsString()
  @IsNotEmpty()
  position: string;

  @IsOptional()
  @IsString()
  requestId?: string;
}

export class ListViewsDto {
  @IsUUID()
  pageId: string;

  // Fork: view scoping — embed scope + host page for orphan reconcile
  @IsOptional()
  @IsString()
  embedId?: string;

  @IsOptional()
  @IsUUID()
  sourcePageId?: string;
}

export class CreateViewDto {
  @IsUUID()
  pageId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  embedId?: string;

  @IsOptional()
  @IsUUID()
  sourcePageId?: string;

  @IsOptional()
  @IsIn(['shared', 'personal'])
  visibility?: 'shared' | 'personal';
}

export class UpdateViewDto {
  @IsUUID()
  viewId: string;

  @IsUUID()
  pageId: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  position?: string;
}

export class ViewIdDto {
  @IsUUID()
  viewId: string;

  @IsUUID()
  pageId: string;
}

export class CreateTemplateDto {
  @IsUUID()
  pageId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsObject()
  cells?: Record<string, unknown>;
}

export class UpdateTemplateDto {
  @IsUUID()
  templateId: string;

  @IsUUID()
  pageId: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  icon?: string | null;

  @IsOptional()
  @IsObject()
  cells?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  position?: string;
}

export class TemplateIdDto {
  @IsUUID()
  templateId: string;

  @IsUUID()
  pageId: string;
}
