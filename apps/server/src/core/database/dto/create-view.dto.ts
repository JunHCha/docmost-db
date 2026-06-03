import { IsObject, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateViewDto {
  @IsUUID()
  databaseId: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}
