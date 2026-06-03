import { IsObject, IsOptional, IsString, IsUUID } from 'class-validator';

export class UpdateViewDto {
  @IsUUID()
  viewId: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}
