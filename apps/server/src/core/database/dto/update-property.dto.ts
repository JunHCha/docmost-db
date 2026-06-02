import { IsObject, IsOptional, IsString, IsUUID } from 'class-validator';

export class UpdatePropertyDto {
  @IsUUID()
  propertyId: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}
