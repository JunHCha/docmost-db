import { IsObject, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateTemplateDto {
  @IsUUID()
  databaseId: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsObject()
  propertyValues?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  content?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  embedViews?: Record<string, unknown>;
}
