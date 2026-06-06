import { ArrayNotEmpty, IsArray, IsUUID } from 'class-validator';

export class DeleteRowsDto {
  @IsUUID()
  databaseId: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('all', { each: true })
  pageIds: string[];
}
