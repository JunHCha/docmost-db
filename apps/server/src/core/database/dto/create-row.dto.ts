import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateRowDto {
  @IsUUID()
  databaseId: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  icon?: string;
}
