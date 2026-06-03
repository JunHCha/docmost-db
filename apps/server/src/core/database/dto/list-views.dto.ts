import { IsUUID } from 'class-validator';

export class ListViewsDto {
  @IsUUID()
  databaseId: string;
}
