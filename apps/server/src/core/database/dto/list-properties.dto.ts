import { IsUUID } from 'class-validator';

export class ListPropertiesDto {
  @IsUUID()
  databaseId: string;
}
