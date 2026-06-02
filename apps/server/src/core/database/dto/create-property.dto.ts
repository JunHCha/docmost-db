import { IsObject, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreatePropertyDto {
  @IsUUID()
  databaseId: string;

  @IsString()
  name: string;

  @IsString()
  type: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}
