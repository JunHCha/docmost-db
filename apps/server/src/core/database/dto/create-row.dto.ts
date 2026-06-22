import { IsObject, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateRowDto {
  @IsUUID()
  databaseId: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsUUID()
  templateId?: string;

  // Tagged seed values keyed by propertyId, derived client-side from the active
  // view's filters (issue #103). Each entry is { type, value }; the service
  // validates/normalizes per property and skips anything malformed or foreign.
  // Template values win on conflict.
  @IsOptional()
  @IsObject()
  initialValues?: Record<string, { type: string; value: unknown }>;
}
