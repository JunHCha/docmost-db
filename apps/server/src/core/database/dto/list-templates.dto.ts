import { IsUUID } from 'class-validator';

export class ListTemplatesDto {
  @IsUUID()
  databaseId: string;
}
