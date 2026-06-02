import { IsUUID } from 'class-validator';

export class ListRowsDto {
  @IsUUID()
  databaseId: string;
}
