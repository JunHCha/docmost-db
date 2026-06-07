import { IsOptional, IsString, IsUUID } from 'class-validator';

export class ListViewsDto {
  @IsUUID()
  databaseId: string;

  @IsOptional()
  @IsString()
  embedId?: string;
}
