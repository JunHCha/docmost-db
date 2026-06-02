import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateDatabaseDto {
  @IsUUID()
  spaceId: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsUUID()
  parentPageId?: string;
}
